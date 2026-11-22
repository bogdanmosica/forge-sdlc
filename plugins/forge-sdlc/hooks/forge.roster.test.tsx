// The /forge panel with the host's roster (docs/agents/forge.yaml), through
// `claude plugin test`: each agent row shows its role's resolved agent when it
// is swapped and its resolved model and effort, a slots table lists every
// slot's skill or `disabled`; without forge.yaml the panel is as it was. The
// test answers the files from a virtual tree and reads the drawing back by key.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On } from 'claude-code';
import { SURFACES, textsUnder } from './run-pane.fixture';

const PANE = 'forge';

const agent = (name: string, description: string, model: string, effort: string) =>
  `---\nname: ${name}\ndescription: ${description}\nmodel: ${model}\neffort: ${effort}\n---\n\nBody.\n`;

// The plugin's agents, by the path below the plugin root.
const AGENTS: Record<string, string> = {
  'forge-sdlc/agents/implementer.md': agent('implementer', 'Builds one slice.', 'claude-opus-5-5', 'high'),
  'forge-sdlc/agents/merger.md': agent('merger', 'Takes one finished slice to merge.', 'claude-sonnet-5-5', 'low'),
  'forge-sdlc/agents/reviewer.md': agent('reviewer', 'Reviews one axis of one slice.', 'claude-opus-5-5', 'high'),
};

const ROSTER = [
  'version: 1',
  'roles:',
  '  reviewer:',
  '    agent: my-plugin:reviewer',
  '    model: sonnet',
  '    effort: medium',
  '  merger:',
  '    effort: high',
  'slots:',
  '  implementer.tdd: other-plugin:tdd',
  '  domain-modeling: disabled',
  '  policy: [writing-for-agents, house-style]',
  '',
].join('\n');

function seat(on: On, files: Record<string, string>): void {
  mock.env(on, { HOME: '/home' });
  // a path the mod reads, as the keys above: the plugin's `forge-sdlc/agents/...`
  // wherever the kit puts its root, the host's `docs/agents/<file>` against the session cwd
  const norm = (p: string) =>
    p.match(/(forge-sdlc(?:\/(?:skills|agents)(?:\/.*)?)?|docs\/agents\/[^/]+)$/)?.[1]?.replace(/\/$/, '') ?? p;
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.close', () => ({ value: undefined }));
  on('ui.status', () => ({ value: undefined }));
  on('fs.list', ($, e) => {
    const dir = norm(e.path);
    const names = new Set(
      Object.keys(files)
        .filter((k) => k.startsWith(`${dir}/`))
        .map((k) => k.slice(dir.length + 1).split('/')[0]!),
    );
    if (names.size === 0) throw new Error(`ENOENT: ${e.path}`);
    return { value: [...names].map((name) => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })) };
  });
  on('fs.read', ($, e) => {
    const text = files[norm(e.path)];
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`);
    return { value: text };
  });
  on('fs.exists', ($, e) => ({ value: Object.keys(files).some((k) => k.startsWith(norm(e.path))) }));
  on('process.run', () => {
    throw new Error('spawn glab ENOENT');
  });
  on('agent.list', () => ({ value: [] }));
}

const start = ($: Engine) => $.session.start({ cwd: '/host', surface: 'terminal', isInteractive: true });

const forge = ($: Engine, args = '') =>
  $.command.run({
    command: 'forge',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  });

const mount = ($: Engine, surface: (typeof SURFACES)[number]) =>
  $.ui.mount({
    plugin: 'forge-sdlc',
    surface,
    component: 'Pane',
    requestId: PANE,
    props: {
      title: 'forge',
      isFocused: true,
      bodyColumns: 80,
      placement: 'inline' as const,
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
    viewport: { columns: 120, rows: 50, isFullscreen: true },
  });

test("/forge agents shows a swapped role's agent and the roster's model and effort over the frontmatter", async ($, on) => {
  seat(on, { ...AGENTS, 'docs/agents/forge.yaml': ROSTER });
  await start($);
  await forge($, 'agents');
  for (const surface of SURFACES) {
    const ui = await mount($, surface);
    const agents = textsUnder(await ui.drawn(), 'agents').join('\n');
    expect(agents, surface).toMatch(/forge-sdlc:reviewer\n {2}⇄ my-plugin:reviewer · sonnet · medium\n/);
    // not swapped: the frontmatter model, the roster's effort
    expect(agents, surface).toMatch(/forge-sdlc:merger\n {2}claude-sonnet-5-5 · high\n/);
    // untouched by the roster: the frontmatter
    expect(agents, surface).toMatch(/forge-sdlc:implementer\n {2}claude-opus-5-5 · high\n/);
    await ui.unmount();
  }
});

test("/forge agents lists every slot with its skill or disabled, the roster's over the defaults", async ($, on) => {
  seat(on, { ...AGENTS, 'docs/agents/forge.yaml': ROSTER });
  await start($);
  await forge($, 'agents');
  for (const surface of SURFACES) {
    const ui = await mount($, surface);
    const slots = textsUnder(await ui.drawn(), 'slots');
    expect(slots[0], surface).toBe('slots');
    expect(slots.slice(1), surface).toEqual([
      expect.stringMatching(/^implementer\.tdd +other-plugin:tdd$/),
      expect.stringMatching(/^prototyper\.prototype +mattpocock-skills:prototype$/),
      expect.stringMatching(/^grilling +mattpocock-skills:grilling$/),
      expect.stringMatching(/^spec-writer\.codebase-design +mattpocock-skills:codebase-design$/),
      expect.stringMatching(/^domain-modeling +disabled$/),
      expect.stringMatching(/^policy +writing-for-agents, house-style$/),
    ]);
    await ui.unmount();
  }
});

test('a roster with no policy shows the policy slot as none', async ($, on) => {
  seat(on, { ...AGENTS, 'docs/agents/forge.yaml': 'version: 1\n' });
  await start($);
  await forge($, 'agents');
  const ui = await mount($, 'terminal');
  const slots = textsUnder(await ui.drawn(), 'slots');
  expect(slots).toContainEqual(expect.stringMatching(/^policy +none$/));
  expect(slots).toContainEqual(expect.stringMatching(/^implementer\.tdd +mattpocock-skills:tdd$/));
  await ui.unmount();
});
