// The session store: every Claude session with this plugin publishes one
// SessionRecord to ~/.cache/workbench/sessions/<session id>.json, written by
// that session alone (so no two writers share a file), refreshed every
// HEARTBEAT_MS and removed on session.end. The Boards pane and the band list
// the folder; a record not refreshed for STALE_MS belongs to a session that
// died without its session.end and is ignored.
//
// Everything here hooks engine events (session.start, prompt.submit,
// tool.check, tool.call, turn.complete, session.measure, session.end), never
// the classic.* ones: a built-in plugin, cc-plugin-sec-default, runs first on
// the classic events and passes them on past a mod.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, On } from 'claude-code';
import type { SessionRecord, SessionStatus } from './types';

export const HEARTBEAT_MS = 30_000;
export const STALE_MS = 120_000;
const GONE_MS = 24 * 60 * 60 * 1000; // a record this old belongs to a killed session: removed by any reader
const PERMISSION_WAIT_MS = 6_000; // Claude's own permission notice waits as long; an auto-mode ask settles sooner
const FILES_MAX = 12;
const TEXT_MAX = 120;
const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const PERSON_TOOLS: Record<string, string> = { AskUserQuestion: 'question', ExitPlanMode: 'plan review' };

export const self = atom({ plugin: 'forge-sdlc', key: 'self' } as const, null as SessionRecord | null);

export const sessionsDir = (home: string) => `${home}/.cache/workbench/sessions`;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// The first line of a message that is not a markdown heading, list and quote
// markers stripped, whitespace collapsed, cut at `max` characters.
export function firstLine(message: unknown, max: number): string {
  for (const raw of str(message).split('\n')) {
    if (/^\s*#/.test(raw)) continue;
    const line = raw
      .replace(/^[*>\-\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (line) return Array.from(line).slice(0, max).join('');
  }
  return '';
}

export function relativeTo(cwd: string, path: string): string {
  return cwd && path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path;
}

// A command's stdout, or undefined when it cannot start, times out or fails.
export async function run($: EngineInterface, argv: string[], cwd?: string): Promise<string | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(argv, { timeoutMs: 5000, ...(cwd ? { cwd } : {}) });
    return exitCode === 0 ? stdout : undefined;
  } catch {
    return undefined;
  }
}

async function save($: EngineInterface, record: SessionRecord) {
  const home = await $.env.get('HOME');
  if (!home) return;
  try {
    await $.fs.write(`${sessionsDir(home)}/${record.id}.json`, JSON.stringify(record));
  } catch {
    // a full or unwritable disk only costs the other sessions this one's row
  }
}

// Changes this session's record and publishes it.
// `now` is the engine's clock (mocked under test), handed to `change` too.
export async function patch($: EngineInterface, change: (r: SessionRecord, now: number) => SessionRecord) {
  const now = await $.clock.now();
  const next = await update($, self, (r) => (r ? { ...change(r, now), updatedAt: now } : r));
  if (next) await save($, next);
}

const setStatus = (status: SessionStatus, reason?: string) => (r: SessionRecord, now: number) =>
  r.status === status && r.reason === reason ? r : { ...r, status, reason, since: now };

export async function currentBranch($: EngineInterface, cwd: string): Promise<string | undefined> {
  return (await run($, ['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd))?.trim() || undefined;
}

// Every live session's record, this one included, freshest first.
export async function readSessions($: EngineInterface): Promise<SessionRecord[]> {
  const home = await $.env.get('HOME');
  if (!home) return [];
  const dir = sessionsDir(home);
  const now = await $.clock.now();
  const out: SessionRecord[] = [];
  try {
    for (const entry of await $.fs.list(dir)) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
      try {
        const r = JSON.parse(await $.fs.read(`${dir}/${entry.name}`)) as SessionRecord;
        if (now - r.updatedAt <= STALE_MS) out.push(r);
        else if (now - r.updatedAt > GONE_MS) await run($, ['rm', '-f', `${dir}/${entry.name}`]);
      } catch {
        // a record caught mid-write is read on the next tick
      }
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Creates and publishes this session's record and starts its heartbeat; run
// by workbench.tsx on session.start.
export async function startSession($: EngineInterface) {
  const [id, cwd] = await Promise.all([$.session.id(), $.session.cwd()]);
  const now = await $.clock.now();
  const record: SessionRecord = {
    id,
    cwd,
    repo: cwd.split('/').filter(Boolean).at(-1) ?? cwd,
    branch: await currentBranch($, cwd),
    title: '',
    lastPrompt: '',
    lastReply: '',
    status: 'idle',
    since: now,
    startedAt: now,
    updatedAt: now,
    files: [],
    limits: [],
  };
  // A hot reload of the plugin runs session.start again; $.state outlives it, so
  // the same session keeps what it has gathered.
  const kept = await update($, self, (prev) =>
    prev?.id === id ? { ...prev, cwd, branch: record.branch, updatedAt: now } : record,
  );
  await save($, kept ?? record);
  $.clock.every(HEARTBEAT_MS, () => void patch($, (r) => r));
}

// Marks this session idle after a main-thread turn, with the answer's first
// line and the branch it ended on; run by workbench.tsx on turn.complete.
export async function finishTurn($: EngineInterface, answer: string) {
  const r = await read($, self);
  const branch = r ? await currentBranch($, r.cwd) : undefined;
  await patch($, (rec, now) => ({
    ...setStatus('idle')(rec, now),
    lastTurnAt: now,
    lastReply: firstLine(answer, TEXT_MAX) || rec.lastReply,
    branch: branch ?? rec.branch,
  }));
}

// Marks this session working with the prompt's first line; the first prompt
// names the session. Run from the plugin's one prompt.submit hook.
export async function notePrompt($: EngineInterface, e: { text: string; isMeta?: boolean }) {
  const line = firstLine(e.text, TEXT_MAX);
  if (line && !e.isMeta) {
    await patch($, (r, now) => ({ ...setStatus('working')(r, now), lastPrompt: line, title: r.title || line }));
  }
}

// The prompt.submit hook, for a plugin that holds no other (a plugin may hook
// an event only once without a matcher).
export function registerSessionPrompt(on: On) {
  on('prompt.submit', async ($, e, next) => {
    await notePrompt($, e);
    return next(e);
  });
}

// The matched hooks and the unmatched ones no other part of a plugin holds:
// tool.check, tool.call, session.measure, session.end.
export function registerSessions(on: On) {
  const asked = new Set<string>(); // main-thread calls whose verdict was `ask`, by tool_use_id

  // tool.check runs inside tool.call's next(e): it only notes an `ask`. The
  // call's own timer below turns an ask still open after PERMISSION_WAIT_MS
  // into needs-you, so an ask the auto-mode classifier settles never shows.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e);
    if (verdict.decision === 'ask' && e.tool_use_id && !e.agentId) asked.add(e.tool_use_id);
    return verdict;
  });

  on('tool.call', async ($, e, next) => {
    if (e.agentId) return next(e); // a subagent's calls are its own
    const person = PERSON_TOOLS[e.tool];
    if (person) await patch($, setStatus('needs-you', person));
    const id = e.tool_use_id;
    // A question or a plan already reads needs-you with its own reason.
    const wait = $.clock.after(PERMISSION_WAIT_MS, () => {
      if (asked.has(id) && !person) void patch($, setStatus('needs-you', `permission: ${e.tool}`));
    });
    const result = await next(e).finally(() => {
      wait.cancel();
      asked.delete(id);
    });
    const input = e as unknown as Record<string, unknown>;
    const path = str(input.file_path) || str(input.notebook_path);
    await patch($, (r, now) => ({
      ...setStatus('working')(r, now),
      files:
        EDIT_TOOLS.has(e.tool) && path
          ? [relativeTo(r.cwd, path), ...r.files.filter((f) => f !== relativeTo(r.cwd, path))].slice(0, FILES_MAX)
          : r.files,
    }));
    return result;
  });

  on('session.measure', async ($, e, next) => {
    await patch($, (r) => ({
      ...r,
      ctxPercent: e.context.percent ?? r.ctxPercent,
      costUsd: e.cost?.usd ?? r.costUsd,
      limits: e.rateLimits.map((l) => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
    }));
    return next(e);
  });

  on('session.end', async ($, e, next) => {
    const home = await $.env.get('HOME');
    if (home) await run($, ['rm', '-f', `${sessionsDir(home)}/${e.sessionId}.json`]);
    return next(e);
  });
}
