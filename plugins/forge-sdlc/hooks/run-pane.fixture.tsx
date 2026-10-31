// The world beneath the run pane under `claude plugin test`, shared by its test
// files: the fixture effort as a virtual directory, every `$` call the mod makes
// answered from memory, and readers of the drawn tree.
import { mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { AgentInfo, On, RenderElement } from 'claude-code';

export const PANE = 'run-pane';
export const SURFACES = ['terminal', 'desktop'] as const;
export const HOST_CONFIG = 'docs/agents/forge.md';

// A fixture effort: its map under docs/efforts/alpha, six tickets on the local
// tracker under .scratch/alpha/issues. Open, unblocked, unclaimed (the frontier):
// 03 (blocked by resolved 01) and 06 (blocked by closed 02). 04 is claimed, 05 is
// blocked by 03 and 04, 01 and 02 are closed.
export const FIXTURE: Record<string, string> = {
  'docs/efforts/alpha/map.md': '---\neffort: alpha\nstage: map\n---\n\n# Map: Alpha port\n\n## Notes\n',
  '.scratch/alpha/issues/01-snapshot.md': '# alpha-01: Snapshot\n\nType: research\nStatus: resolved\nBlocked by: none\n',
  '.scratch/alpha/issues/02-skeleton.md': '# 02: Plugin skeleton\n\n**Blocked by:** 01\n\n**Status:** closed\n',
  '.scratch/alpha/issues/03-hooks.md': '# 03: Guardrail hooks\n\n**Blocked by:** 01\n\n**Status:** open\n',
  '.scratch/alpha/issues/04-research.md': '# 04 Legacy research\n\nType: research\nStatus: claimed\nBlocked by: 01\n',
  '.scratch/alpha/issues/05-spec.md': '# 05: Spec skill\n\n**Blocked by:** 03, 04\n\n**Status:** open\n',
  '.scratch/alpha/issues/06-readme.md': '# 06 README\n\nBlocked by: 02\n',
  '.scratch/alpha/issues/notes.txt': 'not a ticket',
};

// A host config in the shape init writes, with the sections a test adds.
export const forgeConfig = (sections = '') =>
  `# forge-sdlc host config\n\n## Proof commands\n- test: node --test\n\n## Branches\n- default: main\n${sections}`;

// A price table in the shape of plugins/forge-sdlc/prices.json, its figures chosen
// for clean arithmetic, not the real ones (tests/prices.test.mjs holds the real file).
export const PRICES = JSON.stringify({
  date: '2026-01-02',
  source: 'fixture',
  unit: 'USD per million tokens',
  models: { 'claude-fable-5-1': { input: 10, output: 100, cacheRead: 1, cacheWrite: 12.5 } },
});

export type Seat = {
  opens: { id: string; focus?: true }[];
  escapes: (true | undefined)[]; // each open's closeOnEscape
  closes: string[];
  status: (string | undefined)[];
  toasts: string[];
  placed: boolean;
  prices: string;
  writes: Record<string, string>;
  store: Record<string, unknown>;
  env: Record<string, string>;
  files: Record<string, string>; // more virtual files, by the path the mod reads
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]; // [] off a subscription
  agents: AgentInfo[]; // what agent.list answers
  writeError: string; // a write refused with this reason; '' writes
  calls: string[]; // 'write' per fs.write, in order with what a test adds
};

// A subscription's windows, reset times counted from the mock clock's epoch start.
export const RATE_LIMITS = [
  { kind: 'five_hour', percentUsed: 23, resetsAt: '1970-01-01T02:15:00.000Z' },
  { kind: 'seven_day', percentUsed: 61, resetsAt: '1970-01-04T06:00:00.000Z' },
];

export function virtualFs(on: On, files: Record<string, string>) {
  // The engine resolves the mod's relative paths against the session's cwd first.
  // The plugin's own prices.json and crew.json are read under `$.plugin.root`,
  // wherever the kit puts it; the host's files by their path under the cwd.
  const norm = (p: string) => {
    if (p.endsWith('/prices.json')) return 'prices.json';
    if (p.endsWith('/crew.json')) return 'crew.json';
    return p.replace(/^.*?(?=(docs\/efforts|docs\/agents|\.scratch|\.forge)(\/|$))/, '').replace(/\/$/, '');
  };
  const children = (dir: string) => {
    const seen = new Map<string, { kind: 'file' | 'dir'; size: number; mtimeMs: number }>();
    for (const path of Object.keys(files)) {
      if (!path.startsWith(dir + '/')) continue;
      const rest = path.slice(dir.length + 1);
      const name = rest.split('/')[0]!;
      const isFile = !rest.includes('/');
      const text = files[path] ?? '';
      seen.set(name, {
        kind: isFile ? 'file' : 'dir',
        size: isFile ? text.length : 0,
        mtimeMs: isFile ? 1000 + path.length : 0,
      });
    }
    return seen;
  };
  on('fs.list', ($, e) => {
    const dir = norm(e.path);
    const entries = children(dir);
    if (entries.size === 0) throw new Error(`ENOENT: ${dir}`);
    return { value: [...entries].map(([name, m]) => ({ name, ...m, isLink: false })) };
  });
  on('fs.read', ($, e) => {
    const text = files[norm(e.path)];
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`);
    return { value: text };
  });
  on('fs.exists', ($, e) => ({ value: norm(e.path) in files || children(norm(e.path)).size > 0 }));
}

// Everything the engine would answer beneath the mod, from memory.

export function seat(on: On, overrides: Partial<Seat> = {}): Seat {
  const s: Seat = {
    opens: [],
    escapes: [],
    closes: [],
    status: [],
    toasts: [],
    placed: true,
    prices: PRICES,
    writes: {},
    store: {},
    env: {},
    files: {},
    rateLimits: RATE_LIMITS,
    agents: [
      { id: 'agent-1', description: 'research the auth flow', type: 'researcher', status: 'running' },
      { id: 'agent-2', description: 'review slice 03', type: 'reviewer', status: 'completed' },
    ],
    writeError: '',
    calls: [],
    ...overrides,
  };
  mock.env(on, s.env);
  // The plugin's store, kept where the test can read it back (what mock.store hides).
  on('store.get', ($, e) => ({ value: s.store[e.key] }));
  on('store.set', ($, e) => {
    s.store[e.key] = JSON.parse(JSON.stringify(e.value));
    return { value: undefined };
  });
  on('store.delete', ($, e) => {
    delete s.store[e.key];
    return { value: undefined };
  });
  on('store.keys', () => ({ value: Object.keys(s.store) }));
  // A relative path arrives resolved against the session cwd; recorded as the mod spelled it.
  on('fs.write', ($, e) => {
    s.calls.push('write');
    if (s.writeError) return { deny: s.writeError };
    s.writes[e.path.replace(/^.*?(?=\.forge\/)/, '')] = e.text;
    return { value: undefined };
  });
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('session.cwd', () => ({ value: '/host' })); // the cwd start() opens the session in
  on('session.id', () => ({ value: 'sess-run' })); // the workbench's session record
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('ui.open', ($, e) => {
    s.opens.push({ id: e.id, focus: e.focus });
    s.escapes.push(e.closeOnEscape);
    return {
      value: s.placed ? { isPlaced: true } : { isPlaced: false, reason: 'unasked below 144 columns (100 now)' },
    };
  });
  on('ui.close', ($, e) => {
    s.closes.push(e.id);
    return { value: undefined };
  });
  on('ui.status', ($, e) => {
    s.status.push(e.text);
    return { value: undefined };
  });
  on('ui.toast', ($, e) => {
    s.toasts.push(e.text);
    return { value: undefined };
  });
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      rateLimits: s.rateLimits,
      cost: { usd: 1.25 },
      context: {
        window: 200000,
        tokens: 50000,
        percent: 25,
        breakdown: {
          categories: [
            { name: 'System prompt', tokens: 20000, color: 'promptBorder', isDeferred: false, kind: 'used' },
            { name: 'Messages', tokens: 30000, color: 'inactive', isDeferred: false, kind: 'used' },
            { name: 'Free space', tokens: 120000, color: 'inactive', isDeferred: false, kind: 'free' },
            { name: 'Autocompact buffer', tokens: 30000, color: 'inactive', isDeferred: false, kind: 'buffer' },
          ],
          totalTokens: 50000,
          maxTokens: 200000,
          rawMaxTokens: 200000,
          autocompactSource: 'model-default',
          percentage: 25,
          gridRows: [],
          model: 'claude-fable-5-1',
          memoryFiles: [],
          mcpTools: [],
          agents: [],
          isAutoCompactEnabled: true,
          apiUsage: null,
        },
      },
    },
  }));
  on('agent.list', () => ({ value: s.agents }));
  // No git beneath: the session's directory is the project (run-pane.tsx projectDir).
  on('process.run', () => ({
    value: { exitCode: 1, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false },
  }));
  // The crew presets the plugin ships, as one short preset (crew.json is read under `$.plugin.root`).
  const presets = JSON.stringify({
    presets: { 'star-trek': { label: 'Star Trek', names: { implementer: ['Scotty'], general: ['Nog'] } } },
  });
  // One object, the seat's own: a test lays a file after the start by writing to `s.files`.
  s.files = { ...FIXTURE, 'prices.json': s.prices, 'crew.json': presets, ...s.files };
  virtualFs(on, s.files);
  return s;
}

export const paneProps = (bodyColumns: number) => ({
  title: 'Run',
  isFocused: false,
  bodyColumns,
  placement: 'inline' as const,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
});

export async function start($: Engine, clock: ReturnType<typeof mock.clock>) {
  await $.session.start({ cwd: '/host', surface: 'terminal', isInteractive: true });
  await clock.advance(5000);
}

export function runPane($: Engine, columns: number, args = '') {
  return $.command.run({
    command: 'forge-pane',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns },
  });
}

// The pane drawn on a surface, read by key.
export async function pane($: Engine, surface: (typeof SURFACES)[number] = 'terminal') {
  const ui = await $.ui.mount({
    plugin: 'forge-sdlc',
    surface,
    component: 'Pane',
    requestId: PANE,
    props: paneProps(80),
    viewport: { columns: 160, rows: 50, isFullscreen: true },
  });
  return ui;
}

// The texts drawn inside the Box keyed `key`, in document order; a Box drawn
// `display: none` (a tooltip card until hovered) is not drawn.
export function textsUnder(tree: RenderElement, key: string): string[] {
  const out: string[] = [];
  const walk = (node: unknown, inside: boolean) => {
    if (typeof node === 'string') {
      if (inside) out.push(node);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const el = node as { type?: string; props?: { key?: string; display?: string }; children?: unknown[] };
    if (el.props?.display === 'none') return; // a tooltip card: not drawn until hovered
    const here = inside || (el.type === 'Box' && el.props?.key === key);
    if (el.type === 'Text' && here) {
      out.push((el.children ?? []).join(''));
      return;
    }
    for (const child of el.children ?? []) walk(child, here);
  };
  walk(tree, false);
  return out;
}

// Drives one model request through the mod's turn.step hook, the stream beneath
// answered by the test, and settles to the result the mod returned.
export async function step($: Engine, on: On, agentId: string | undefined) {
  const stream = $.turn.step({
    turnId: 't1',
    index: 0,
    model: 'claude-fable-5-1',
    messageCount: 1,
    ...(agentId ? { agentId } : {}),
  });
  while (!(await stream.next()).done) {
    /* nothing streams from the test's bottom */
  }
  return stream.result;
}

export const bandProps = (overrides: { hasSurvey?: boolean; isWorking?: boolean } = {}) => ({
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 155,
  scroll: { offset: 0, bodyRows: 9 },
  view: {},
  ...overrides,
});

// The run's figures in the band above the prompt, its two rows a line each.
export async function band($: Engine, overrides: { hasSurvey?: boolean } = {}): Promise<string> {
  const ui = await $.ui.mount({
    plugin: 'forge-sdlc',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: bandProps(overrides),
  });
  const tree = await ui.drawn();
  const text = [textsUnder(tree, 'figures').join(''), textsUnder(tree, 'figures-2').join('')]
    .filter(Boolean)
    .join('\n');
  await ui.unmount();
  return text;
}
