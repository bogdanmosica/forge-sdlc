// The stand-in host shared by the workbench mod's tests: HOME, a virtual file
// system holding the session records, git and glab answered by command, Jira
// answered by URL, the model's responses, the clock mocked, and a person who
// answers permission prompts and copies.
import { mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On } from 'claude-code';
import type { SessionRecord } from './types';

export const HOME = '/home/u';
export const CWD = '/repo/app';
export const SID = 'sess-1';
export const RECORD = `${HOME}/.cache/workbench/sessions/${SID}.json`;

export type Host = {
  files: Record<string, string>;
  runs: string[][];
  git: Record<string, string>; // `git <args>` -> stdout; a missing one exits 1
  glab?: string; // `glab mr view` stdout; absent exits 1 (no VPN)
  glabByCwd: Record<string, string>; // per folder, before `glab`
  env: Record<string, string>; // the environment besides HOME
  wc?: string; // `wc -l` stdout for the untracked files
  jira: Record<string, string>; // issue key -> Jira's JSON; a missing one answers 404
  fetches: { url: string; headers: Record<string, string> }[]; // every $.http.fetch
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  forks: string[]; // prompts the model was forked with
  spawns: Record<string, unknown>[]; // agents started
  refused: string[]; // command names the host refuses
  forkable: boolean; // whether model.fork has a request to reuse
  completions: string[]; // model.complete requests, as JSON
  registered: string[]; // command names registered
  writes: SessionRecord[]; // every version of this session's record, in order
  copied: string[]; // what the person copied
  release?: () => void; // answers a permission prompt the host holds open
  holdPermission: boolean;
};

export const OK = (stdout: string) => ({
  exitCode: 0,
  stdout,
  stderr: '',
  isStdoutTruncated: false,
  isStderrTruncated: false,
});
export const FAIL = { exitCode: 1, stdout: '', stderr: 'no', isStdoutTruncated: false, isStderrTruncated: false };

export function host(on: On): Host {
  const h: Host = {
    files: {},
    runs: [],
    git: {
      'rev-parse --abbrev-ref HEAD': 'feat/x\n',
      'status --porcelain --untracked-files=no': ' M a.ts\n M b.ts\n',
      'rev-list --count @{u}..HEAD': '1\n',
    },
    writes: [],
    glabByCwd: {},
    env: {},
    jira: {},
    fetches: [],
    usage: {
      input_tokens: 3,
      output_tokens: 500,
      cache_read_input_tokens: 90_000,
      cache_creation_input_tokens: 14_497,
    },
    forks: [],
    spawns: [],
    refused: [],
    forkable: true,
    completions: [],
    registered: [],
    copied: [],
    holdPermission: false,
  };
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : h.env[e.name] }));
  on('session.id', () => ({ value: SID }));
  on('session.cwd', () => ({ value: CWD }));
  on('fs.write', ($, e) => {
    h.files[e.path] = e.text;
    if (e.path === RECORD) h.writes.push(JSON.parse(e.text) as SessionRecord);
    return { value: undefined };
  });
  on('fs.read', ($, e) => {
    if (!(e.path in h.files)) throw new Error(`ENOENT: ${e.path}`);
    return { value: h.files[e.path] ?? '' };
  });
  // A folder's entries: a file, or a dir when deeper paths sit under it.
  on('fs.list', ($, e) => {
    const entries = new Map<string, 'file' | 'dir'>();
    for (const p of Object.keys(h.files)) {
      if (!p.startsWith(`${e.path}/`)) continue;
      const [name = '', ...deeper] = p.slice(e.path.length + 1).split('/');
      entries.set(name, deeper.length ? 'dir' : 'file');
    }
    return { value: [...entries].map(([name, kind]) => ({ name, kind, size: 1, mtimeMs: 0, isLink: false })) };
  });
  // The engine's own band above the prompt, drawn when no plugin draws one: empty here.
  // (a tree as data: JSX here would call the host object `h`, not the element factory)
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', children: [] }) as never);
  on('model.fork', ($, e) => {
    h.forks.push(e.prompt);
    const usage = { input_tokens: 1, output_tokens: 1 };
    return {
      value: h.forkable
        ? { isAnswered: true, text: `**Answer** to: ${e.prompt}`, usage }
        : { isAnswered: false, reason: 'nothing-to-fork', usage },
    } as never;
  });
  on(
    'session.messages',
    () =>
      ({
        value: [
          { role: 'user', text: 'Rename the lane hook', toolUses: [] },
          { role: 'assistant', text: 'Renamed it to claude-lane.sh.', toolUses: [] },
        ],
      }) as never,
  );
  on('session.model', () => ({ value: 'claude-haiku-5-5' }));
  on('model.complete', ($, e) => {
    h.completions.push(JSON.stringify(e));
    return {
      value: { isAnswered: true, text: 'From the transcript: renamed.', usage: { input_tokens: 1, output_tokens: 1 } },
    } as never;
  });
  on('agent.spawn', ($, e) => {
    h.spawns.push({ ...e });
    return { deny: 'not started under test' } as never; // recorded, never run: no agent outlives the test
  });
  on('http.fetch', ($, e) => {
    h.fetches.push({ url: e.url, headers: { ...e.init?.headers } });
    const key = /\/issue\/([^?]+)/.exec(e.url)?.[1] ?? '';
    const body = h.jira[decodeURIComponent(key)];
    return {
      value:
        body === undefined
          ? { status: 404, ok: false, headers: {}, text: '{}' }
          : { status: 200, ok: true, headers: {}, text: body },
    };
  });
  // The model beneath: every request answers whole with the host's usage.
  // eslint-disable-next-line require-yield, sonarjs/generator-without-yield -- a turn.step hook must be an async generator (StreamHookBody); this stand-in answers whole, with no chunks
  on('turn.step', async function* ($, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { ...h.usage, model: 'claude-haiku-5-5' },
    };
  });
  on('ui.copy', ($, e) => {
    h.copied.push(e.text);
    return { value: { isCopied: true } } as never;
  });
  on('process.run', ($, e) => {
    const argv = [...e.argv];
    h.runs.push(argv);
    if (argv[0] === 'git') {
      const out = h.git[argv.slice(1).join(' ')];
      return { value: out === undefined ? FAIL : OK(out) };
    }
    if (argv[0] === 'glab') {
      const out = h.glabByCwd[e.init?.cwd ?? ''] ?? h.glab;
      return { value: out === undefined ? FAIL : OK(out) };
    }
    if (argv[0] === 'wc') return { value: OK(h.wc ?? '') };
    if (argv[0] === 'rm') for (const p of argv.slice(2)) delete h.files[p];
    return { value: OK('') };
  });
  // Nothing of the host runs beneath the mod: each engine event settles on a plain answer.
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('prompt.submit', ($, e) => e as never);
  on('turn.complete', ($, e) => ({ text: e.answer }) as never);
  on('session.measure', ($, e) => ({ changed: e.changed }));
  on('session.end', ($, e) => ({ sessionId: e.sessionId }));
  // A name another plugin holds is refused, as cc-plugin-diff refuses /diff.
  on('command.register', ($, e) => {
    if (h.refused.includes(e.name)) throw new Error(`"/${e.name}" refused: another plugin registered it already`);
    h.registered.push(e.name);
    return { value: {} } as never;
  });
  on('ui.open', () => ({ value: { isPlaced: true } }) as never);
  on('tool.check', () => ({ decision: 'ask' as const }));
  on('tool.call', ($, e) => ({ result: { tool: e.tool } as never }));
  // The person at a permission prompt: allows at once, or when the test releases it.
  on('classic.PermissionRequest', () =>
    h.holdPermission
      ? new Promise((resolve) => {
          h.release = () => resolve({ decision: { behavior: 'allow' } });
        })
      : { decision: { behavior: 'allow' as const } },
  );
  return h;
}

export const record = (h: Host): SessionRecord => JSON.parse(h.files[RECORD] ?? 'null') as SessionRecord;

export async function start($: Engine, on: On, prepare: (h: Host) => void = () => {}) {
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 27, 12, 0, 0) });
  const h = host(on);
  prepare(h);
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true });
  await clock.advance(0);
  return { h, clock };
}

export const turn = ($: Engine, answer: string) =>
  $.turn.complete({ answer, durationMs: 1000, isAborted: false, turnId: 't1', reason: 'end_turn' } as never);

// Every text in a drawing, joined in document order.
export function texts(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return ((node as { children?: unknown[] } | null)?.children ?? []).map(texts).join('');
}

// One model request of the main thread (or of a subagent), drained.
export async function step($: Engine, agentId?: string) {
  const stream = $.turn.step({
    turnId: 't1',
    index: 0,
    model: 'claude-haiku-5-5',
    messageCount: 1,
    ...(agentId ? { agentId } : {}),
  });
  while (!(await stream.next()).done) {
    /* nothing streams from the host's bottom */
  }
}
