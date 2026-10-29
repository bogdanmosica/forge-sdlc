// The Focus pane (`/focus-pane`): this session at a glance, the mod counterpart of
// cmux-config's Focus board. Branch with its diff against the default branch
// and its uncommitted and unpushed counts, the Jira ticket named in the branch,
// the status, context, prompt cache, cost and rate limits with their resets,
// the branch's MR from glab with the ready-to-merge checklist (needs the VPN;
// silent without it), the last prompt and reply, and the files edited.
// Git, the MR and the ticket are refreshed every REFRESH_MS on a timer, so the
// pane never waits on glab or Jira while drawing.
import { atom, read, update } from 'claude-code';
import type { EngineInterface, On } from 'claude-code';
import type { FocusCache, FocusGit, FocusJira, FocusMr, GateState, MergeGate, SessionRecord } from './types';
import { patch, run } from './sessions';
import { jiraKey, jiraState } from './jira';

export const FOCUS_PANE = 'workbench-focus';
const REFRESH_MS = 60_000;
const JIRA_MS = 5 * 60_000; // a ticket is cached 10 min; this bounds the retries off VPN
// Claude Code sessions on a subscription write the 1-hour prompt cache (the
// status line's prompt_cache.ttl reads 1h); the mod API does not report it.
export const CACHE_TTL_MS = 60 * 60_000;
const UNTRACKED_MAX = 200; // untracked files counted into the diff stat

// This session's record, written by sessions.ts; read here to draw.
const self = atom({ plugin: 'workbench', key: 'self' } as const, null as SessionRecord | null);
const focusMr = atom({ plugin: 'workbench', key: 'focusMr' } as const, null as FocusMr | null);
const focusGit = atom({ plugin: 'workbench', key: 'focusGit' } as const, null as FocusGit | null);
const focusJira = atom({ plugin: 'workbench', key: 'focusJira' } as const, null as FocusJira | null);
// The last ticket asked for, so off VPN the next ask waits JIRA_MS.
const focusJiraTried = atom(
  { plugin: 'workbench', key: 'focusJiraTried' } as const,
  null as { key: string; at: number } | null,
);
const focusCache = atom({ plugin: 'workbench', key: 'focusCache' } as const, null as FocusCache | null);

// Lines the checkout has that origin's default branch lacks: `git diff
// --shortstat` against their merge base, untracked files counted as added, as
// cmux-config's refresh-diff.sh counts them.
async function diffStat($: EngineInterface, cwd: string) {
  const base = (await run($, ['git', 'symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD'], cwd))?.trim();
  const mergeBase = base ? (await run($, ['git', 'merge-base', base, 'HEAD'], cwd))?.trim() : undefined;
  const stat = await run($, ['git', 'diff', '--shortstat', mergeBase || 'HEAD', '--'], cwd);
  if (stat === undefined) return {};
  // " 3 files changed, 40 insertions(+), 2 deletions(-)"
  let added = 0;
  let removed = 0;
  for (const part of stat.split(',')) {
    const [n = '', word = ''] = part.trim().split(' ');
    if (word.startsWith('insertion')) added = Number(n) || 0;
    if (word.startsWith('deletion')) removed = Number(n) || 0;
  }
  const untracked = (await run($, ['git', 'ls-files', '--others', '--exclude-standard'], cwd))
    ?.split('\n')
    .filter(Boolean)
    .slice(0, UNTRACKED_MAX);
  if (untracked?.length) {
    const counts = (await run($, ['wc', '-l', '--', ...untracked], cwd)) ?? '';
    for (const line of counts.split('\n')) {
      const [n, name] = line.trim().split(/\s+/, 2);
      if (name && name !== 'total') added += Number(n) || 0;
    }
  }
  return { added, removed, base: mergeBase ? base?.replace(/^origin\//, '') : 'HEAD' };
}

export async function gitState($: EngineInterface, cwd: string): Promise<FocusGit | null> {
  const status = await run($, ['git', 'status', '--porcelain', '--untracked-files=no'], cwd);
  if (status === undefined) return null; // not a work tree
  const ahead = await run($, ['git', 'rev-list', '--count', '@{u}..HEAD'], cwd);
  const stat = await diffStat($, cwd);
  const checkedAt = await $.clock.now();
  return {
    dirty: status.split('\n').filter(Boolean).length,
    ahead: Number(ahead?.trim() || 0),
    ...stat,
    checkedAt,
  };
}

type GlabMr = {
  iid?: number;
  web_url?: string;
  state?: string;
  draft?: boolean;
  head_pipeline?: { status?: string } | null;
  has_conflicts?: boolean;
  blocking_discussions_resolved?: boolean;
  detailed_merge_status?: string;
};

const isTrunk = (branch: string) => branch === 'main' || branch === 'master' || branch === 'HEAD';

export async function mrState($: EngineInterface, cwd: string, branch: string): Promise<FocusMr | null> {
  if (isTrunk(branch)) return null;
  const out = await run($, ['glab', 'mr', 'view', branch, '--output', 'json'], cwd);
  const checkedAt = await $.clock.now();
  try {
    const mr = JSON.parse(out ?? '') as GlabMr;
    if (!mr.iid || !mr.web_url) return null;
    return {
      iid: mr.iid,
      url: mr.web_url,
      state: mr.state ?? 'opened',
      pipeline: mr.head_pipeline?.status,
      isDraft: Boolean(mr.draft),
      hasConflicts: mr.has_conflicts,
      threadsOpen: mr.blocking_discussions_resolved === undefined ? undefined : !mr.blocking_discussions_resolved,
      mergeStatus: mr.detailed_merge_status,
      checkedAt,
    };
  } catch {
    return null;
  }
}

const CI_WAIT = ['running', 'pending', 'created', 'preparing', 'waiting_for_resource', 'scheduled', 'manual'];
const CI_LABEL: Record<string, string> = { success: 'passed', none: 'no pipeline' };

function ciGate(pipeline: string | undefined): MergeGate {
  const ci = pipeline ?? 'none';
  let state: GateState = 'fail';
  if (ci === 'success') state = 'ok';
  else if (CI_WAIT.includes(ci)) state = 'wait';
  return { label: 'CI green', detail: CI_LABEL[ci] ?? ci.replace(/_/g, ' '), state };
}

function conflictGate(mr: FocusMr): MergeGate {
  const label = 'No conflicts';
  if (mr.mergeStatus === 'need_rebase') return { label, detail: 'needs rebase', state: 'fail' };
  if (mr.hasConflicts === true || mr.mergeStatus === 'conflict') return { label, detail: 'conflicts', state: 'fail' };
  if (mr.hasConflicts === false) return { label, detail: 'clean', state: 'ok' };
  return { label, detail: '', state: 'unknown' };
}

function threadsGate(mr: FocusMr): MergeGate {
  const label = 'Threads resolved';
  if (mr.threadsOpen === true || mr.mergeStatus === 'discussions_not_resolved')
    return { label, detail: 'open threads', state: 'fail' };
  if (mr.threadsOpen === false) return { label, detail: 'resolved', state: 'ok' };
  return { label, detail: '', state: 'unknown' };
}

// GitLab's `mergeable` means approved, `not_approved` not; else not known yet.
function approvedGate(mr: FocusMr): MergeGate {
  const label = 'Approved';
  if (mr.mergeStatus === 'mergeable') return { label, detail: 'mergeable', state: 'ok' };
  if (mr.mergeStatus === 'not_approved') return { label, detail: 'not approved', state: 'fail' };
  return { label, detail: 'after the other checks', state: 'unknown' };
}

function treeGate(git: FocusGit | null): MergeGate {
  const label = 'Tree clean';
  if (!git) return { label, detail: 'no git', state: 'unknown' };
  return git.dirty ? { label, detail: 'uncommitted changes', state: 'fail' } : { label, detail: 'clean', state: 'ok' };
}

// The ready-to-merge checklist for an open MR, the gates of cmux-config's
// Focus board (`mergeGates` in boards.js) but the agent todos, which a mod
// cannot read.
export function mergeGates(mr: FocusMr | null, git: FocusGit | null): MergeGate[] | null {
  if (mr?.state !== 'opened') return null;
  const gates = [ciGate(mr.pipeline), conflictGate(mr), threadsGate(mr), approvedGate(mr)];
  if (mr.isDraft || mr.mergeStatus === 'draft_status')
    gates.push({ label: 'Not a draft', detail: 'still a draft', state: 'fail' });
  gates.push(treeGate(git));
  return gates;
}

// "N blocking" red, "N pending" yellow, else "ready to merge" green.
export function gateSummary(gates: MergeGate[]): { text: string; color: string } {
  const fail = gates.filter((g) => g.state === 'fail').length;
  const wait = gates.filter((g) => g.state === 'wait' || g.state === 'unknown').length;
  if (fail) return { text: `${fail} blocking`, color: 'red' };
  if (wait) return { text: `${wait} pending`, color: 'yellow' };
  return { text: 'ready to merge', color: 'green' };
}

// "2h 10m", "45m", "<1m", "3d 4h": time left until `ms` from now.
function left(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

// The prompt-cache chip of cmux-config's Focus board (`cacheChip`): green while
// the cached prefix is within its TTL, yellow in its last sixth, red once cold
// with what the next request re-sends, grey when no request used the cache.
export function cacheChip(c: FocusCache | null, now: number): { text: string; color: string } | null {
  if (!c) return null;
  if (!c.isObserved) return { text: 'cache off', color: 'gray' };
  const rest = c.at + CACHE_TTL_MS - now;
  if (rest <= 0) {
    const k = c.tokens >= 1000 ? `${Math.floor(c.tokens / 1000)}k` : String(c.tokens);
    return { text: c.tokens ? `cache cold · ${k}` : 'cache cold', color: 'red' };
  }
  return { text: `cache ${left(rest)}`, color: rest <= Math.max(60_000, CACHE_TTL_MS / 6) ? 'yellow' : 'green' };
}

export async function refreshFocus($: EngineInterface) {
  const r = await read($, self);
  if (!r) return;
  const now = await $.clock.now();
  const key = jiraKey(r.branch);
  const tried = await read($, focusJiraTried);
  const askJira = key && (tried?.key !== key || now - tried.at >= JIRA_MS);
  if (askJira) await update($, focusJiraTried, () => ({ key, at: now }));
  const [git, mr, jira] = await Promise.all([
    gitState($, r.cwd),
    r.branch ? mrState($, r.cwd, r.branch) : null,
    askJira ? jiraState($, key) : undefined,
  ]);
  await update($, focusGit, () => git);
  if (git) await patch($, (rec) => ({ ...rec, dirty: git.dirty, ahead: git.ahead }));
  await update($, focusMr, () => mr);
  if (!key) await update($, focusJira, () => null);
  else if (jira !== undefined) await update($, focusJira, (prev) => jira ?? (prev?.key === key ? prev : null));
}

const pct = (n: number | undefined) => (n === undefined ? '–' : `${Math.round(n)}%`);
function tone(n: number | undefined, warn: number, bad: number): string | undefined {
  if (n === undefined) return undefined;
  if (n >= bad) return 'red';
  return n >= warn ? 'yellow' : 'green';
}
const STATUS_COLOR: Record<string, string> = { working: 'blue', idle: 'green', 'needs-you': 'yellow' };
const PIPELINE_COLOR: Record<string, string> = { success: 'green', failed: 'red', running: 'blue', pending: 'yellow' };
const GATE_GLYPH: Record<GateState, string> = { ok: '✓', fail: '✗', wait: '◔', unknown: '?' };
const GATE_COLOR: Record<GateState, string> = { ok: 'green', fail: 'red', wait: 'yellow', unknown: 'gray' };

function ticketColor(status: string): string | undefined {
  const s = status.toLowerCase();
  if (/done|closed|resolved|released/.test(s)) return 'green';
  if (/progress|review|test|qa/.test(s)) return 'blue';
  return undefined;
}

function statusText(r: SessionRecord) {
  return r.status === 'needs-you' ? `needs you · ${r.reason ?? ''}` : r.status;
}

// Run by the session store once this session's record exists.
export async function startFocus($: EngineInterface) {
  await $.command.register({
    name: 'focus-pane',
    description: 'Show this session at a glance: branch, ticket, MR, merge checklist, usage, files',
  });
  $.clock.after(0, () => void refreshFocus($));
  $.clock.every(REFRESH_MS, () => void refreshFocus($));
}

export function registerFocus(on: On) {
  on('command.run', { command: 'focus-pane' }, async ($) => {
    await refreshFocus($);
    await $.ui.open({ id: FOCUS_PANE, title: 'Focus' });
    return { text: 'Focus pane opened.' };
  });

  // Each main-thread response: when it came and what the next request re-sends.
  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e);
    const u = step.usage;
    if (!e.agentId && u) {
      const at = await $.clock.now();
      const cached = u.cache_read_input_tokens + u.cache_creation_input_tokens;
      await update($, focusCache, () => ({
        at,
        tokens: u.input_tokens + cached + u.output_tokens,
        isObserved: cached > 0,
      }));
    }
    return step;
  });

  on('ui.render', { component: 'Pane', requestId: FOCUS_PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const [r, git, mr, jira, cache, now] = await Promise.all([
      read($, self),
      read($, focusGit),
      read($, focusMr),
      read($, focusJira),
      read($, focusCache),
      $.clock.now(),
    ]);
    if (!r) return <Text dimColor>Starting…</Text>;
    const gates = mergeGates(mr, git);
    const summary = gates && gateSummary(gates);
    const chip = cacheChip(cache, now);
    const room = Math.max(1, (e.viewport?.rows ?? 30) - 9 - (jira ? 1 : 0) - (gates ? gates.length + 1 : 0));
    const limitKind: Record<string, string> = { five_hour: '5h', seven_day: '7d' };
    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>{r.repo}</Text>
          <Text dimColor> · </Text>
          <Text color={STATUS_COLOR[r.status]}>{statusText(r)}</Text>
        </Box>
        <Box>
          <Text>⎇ {r.branch ?? 'no git'}</Text>
          {git?.added !== undefined && (
            <Text>
              <Text color="green"> +{git.added}</Text>
              <Text color="red"> −{git.removed ?? 0}</Text>
              <Text dimColor> vs {git.base}</Text>
            </Text>
          )}
          {git && git.dirty > 0 && <Text color="yellow"> {git.dirty} uncommitted</Text>}
          {git && git.ahead > 0 && <Text color="yellow"> ↑{git.ahead}</Text>}
          <Text dimColor> · </Text>
          {mr ? (
            <Text>
              <Text>MR !{mr.iid} </Text>
              <Text dimColor>{mr.isDraft ? 'draft ' : ''}</Text>
              <Text>{mr.state}</Text>
              {mr.pipeline && <Text color={PIPELINE_COLOR[mr.pipeline]}> · ci {mr.pipeline}</Text>}
            </Text>
          ) : (
            <Text dimColor>no MR found</Text>
          )}
        </Box>
        {jira && (
          <Box>
            <Text bold>{jira.key} </Text>
            <Text color={ticketColor(jira.status)}>[{jira.status || '–'}] </Text>
            <Text>{jira.summary}</Text>
          </Box>
        )}
        <Box>
          <Text>ctx </Text>
          <Text color={tone(r.ctxPercent, 20, 40)}>{pct(r.ctxPercent)}</Text>
          {chip && (
            <Text>
              <Text dimColor> · </Text>
              <Text color={chip.color}>{chip.text}</Text>
            </Text>
          )}
          <Text dimColor> · </Text>
          <Text>{r.costUsd === undefined ? '$–' : `$${r.costUsd.toFixed(2)}`}</Text>
          {r.limits.map((l) => {
            const resets = l.resetsAt ? Date.parse(l.resetsAt) : NaN;
            return (
              <Text>
                <Text dimColor> · {limitKind[l.kind] ?? l.kind} </Text>
                <Text color={tone(l.percentUsed, 75, 90)}>{pct(l.percentUsed)}</Text>
                {resets > now && <Text dimColor> ↻{left(resets - now)}</Text>}
              </Text>
            );
          })}
        </Box>
        {gates && summary && (
          <Box flexDirection="column">
            <Box>
              <Text bold>READY TO MERGE </Text>
              <Text color={summary.color}>{summary.text}</Text>
            </Box>
            {gates.map((g) => (
              <Box>
                <Text color={GATE_COLOR[g.state]}>{GATE_GLYPH[g.state]} </Text>
                <Text>{g.label}</Text>
                {g.detail && <Text dimColor> · {g.detail}</Text>}
              </Box>
            ))}
          </Box>
        )}
        <Text>› {r.lastPrompt || '–'}</Text>
        <Text dimColor>{r.lastReply || ' '}</Text>
        <Text bold>FILES {r.files.length === 0 ? '' : `(${r.files.length})`}</Text>
        {r.files.length === 0 && <Text dimColor>none edited yet</Text>}
        {r.files.slice(0, room).map((f) => (
          <Text>{f}</Text>
        ))}
      </Box>
    );
  });
}
