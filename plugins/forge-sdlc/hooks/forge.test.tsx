// The /forge panel through `claude plugin test`: the plugin's commands read
// from the skills' own SKILL.md files, mattpocock-skills' from the newest
// release in the install cache, and the loop with where the driver is needed.
// The test answers the files from a virtual tree and reads the drawing back
// by key.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On } from 'claude-code';
import { SURFACES, textsUnder } from './run-pane.fixture';

const PANE = 'forge';

const skill = (name: string, description: string, hint?: string) => {
  const hintLine = hint ? `argument-hint: ${hint}\n` : '';
  return `---\nname: ${name}\ndescription: ${description}\n${hintLine}---\n\nBody.\n`;
};

// The plugin's skills and agents, and mattpocock-skills' releases in the
// install cache (by category, one folder down), by the path below the cache.
const FILES: Record<string, string> = {
  'forge-sdlc/skills/wayfinder/SKILL.md': skill(
    'wayfinder',
    'The front door of the forge-sdlc loop. Start an effort from an idea...',
    '"<idea> | #issue | <slug>"',
  ),
  'forge-sdlc/skills/build/SKILL.md': skill('build', "Build an effort's approved plan unattended. More.", '<slug>'),
  'forge-sdlc/skills/init/SKILL.md': skill('init', 'Set up a host for the forge-sdlc loop once.'),
  'forge-sdlc/skills/status/SKILL.md': skill('status', 'Print where forge-sdlc efforts stand. Read-only.', '"[slug]"'),
  'forge-sdlc/skills/brand-new/SKILL.md': skill('brand-new', 'A skill no group names yet.'),
  'forge-sdlc/agents/merger.md':
    '---\nname: merger\ndescription: Takes one finished slice from evidence to merge. More.\nmodel: claude-sonnet-5-5\neffort: low\n---\n\nBody.\n',
  'forge-sdlc/agents/reviewer.md':
    '---\nname: reviewer\ndescription: Reviews one axis of one slice.\nmodel: claude-opus-5-5\neffort: high\n---\n\nBody.\n',
  'forge-sdlc/agents/notes.txt': 'not an agent',
  'mattpocock-skills/1.3.1/skills/engineering/tdd/SKILL.md': skill('tdd', 'Test-driven development.'),
  'mattpocock-skills/1.3.1/skills/productivity/grilling/SKILL.md': skill('grilling', 'Grill the user about a plan.'),
  'mattpocock-skills/1.3.1/skills/productivity/README.md': 'a category note, not a skill',
  'mattpocock-skills/1.2.0/skills/engineering/only-in-old/SKILL.md': skill('only-in-old', 'Gone in 1.3.1.'),
};

type Seat = { opens: { id: string; focus?: boolean }[]; escapes: (true | undefined)[]; closes: string[] };

function seat(on: On, files: Record<string, string> = FILES): Seat {
  const s: Seat = { opens: [], escapes: [], closes: [] };
  mock.env(on, { HOME: '/home' });
  // a path the mod reads, as the key above: the plugin's `forge-sdlc/skills/...`
  // wherever the kit puts its root, the cache's `mattpocock-skills[/<version>[/skills/...]]`
  const norm = (p: string) =>
    p
      .match(/((?:forge-sdlc|mattpocock-skills)(?:\/\d[\w.-]*)?(?:\/(?:skills|agents)(?:\/.*)?)?)$/)?.[1]
      ?.replace(/\/$/, '') ?? p;
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('ui.open', ($, e) => {
    s.opens.push({ id: e.id, focus: e.focus });
    s.escapes.push(e.closeOnEscape);
    return { value: { isPlaced: true } };
  });
  on('ui.close', ($, e) => {
    s.closes.push(e.id);
    return { value: undefined };
  });
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
  return s;
}

const forge = ($: Engine, args = '') =>
  $.command.run({
    command: 'forge',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  });

const paneProps = (bodyColumns: number) => ({
  title: 'forge',
  isFocused: true,
  bodyColumns,
  placement: 'inline' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
});

async function mount($: Engine, surface: (typeof SURFACES)[number]) {
  return $.ui.mount({
    plugin: 'forge-sdlc',
    surface,
    component: 'Pane',
    requestId: PANE,
    props: paneProps(80),
    viewport: { columns: 120, rows: 50, isFullscreen: true },
  });
}

const start = ($: Engine) => $.session.start({ cwd: '/host', surface: 'terminal', isInteractive: true });

test(
  "/forge opens the panel focused on the commands, read from the skills' own files, on terminal and desktop",
  async ($, on) => {
    const s = seat(on);
    await start($);
    const ran = await forge($);
    expect(ran.text).toBe('forge panel opened.');
    expect(s.opens).toEqual([{ id: PANE, focus: true }]);
    for (const surface of SURFACES) {
      const ui = await mount($, surface);
      const tree = await ui.drawn();
      const loop = textsUnder(tree, 'group-Loop').join('\n');
      expect(loop, surface).toMatch(/\/forge-sdlc:wayfinder <idea> \| #issue \| <slug>/); // the hint's quotes stripped
      expect(loop, surface).toMatch(/The front door of the forge-sdlc loop\./);
      expect(loop, surface).not.toMatch(/Start an effort/); // the first sentence only
      expect(loop.indexOf('wayfinder'), surface).toBeLessThan(loop.indexOf('build')); // the loop's order
      expect(textsUnder(tree, 'group-Setup').join('\n'), surface).toMatch(/\/forge-sdlc:init/);
      const tools = textsUnder(tree, 'group-Tools').join('\n');
      expect(tools, surface).toMatch(/\/forge-sdlc:status \[slug\]/);
      expect(tools, surface).toMatch(/\/forge-pane/);
      expect(tools, surface).toMatch(/\/handoff-new \[focus\]/);
      // the workbench views' commands, registered by focus.tsx, boards.tsx and commands.tsx
      expect(tools, surface).toMatch(/\/focus-pane/);
      expect(tools, surface).toMatch(/\/boards/);
      expect(tools, surface).toMatch(/\/diff-pane \[branch \| working \| staged \| <ref>\]/);
      expect(tools, surface).toMatch(/\/side-chat <question>/);
      expect(tools, surface).toMatch(/\/morning/);
      expect(tools, surface).toMatch(/\/crew <agent type> <task>/);
      expect(tools, surface).toMatch(/\/forge \[loop/);
      // a skill no group names still shows, under Other
      expect(textsUnder(tree, 'group-Other').join('\n'), surface).toMatch(/\/forge-sdlc:brand-new/);
      const all = textsUnder(tree, 'commands').join('\n');
      expect(all, surface).not.toMatch(/notes|mattpocock-skills:/);
      await ui.unmount();
    }
  },
);

test(
  "the m Button lists mattpocock-skills' commands from the newest cached release, and hides them again",
  async ($, on) => {
    seat(on);
    await start($);
    await forge($);
    for (const surface of SURFACES) {
      const ui = await mount($, surface);
      await ui.press({ key: 'upstream' });
      const upstream = textsUnder(await ui.drawn(), 'group-mattpocock-skills').join('\n');
      expect(upstream, surface).toMatch(/\/mattpocock-skills:grilling/);
      expect(upstream, surface).toMatch(/\/mattpocock-skills:tdd/);
      expect(upstream, surface).not.toMatch(/only-in-old|README/); // 1.3.1 over 1.2.0; a category note is no skill
      await ui.press({ key: 'upstream' });
      expect(textsUnder(await ui.drawn(), 'group-mattpocock-skills'), surface).toEqual([]);
      await ui.unmount();
    }
  },
);

test('/forge loop opens on how the loop runs: each stage, and where the driver is needed', async ($, on) => {
  seat(on);
  await start($);
  await forge($, 'loop');
  for (const surface of SURFACES) {
    const ui = await mount($, surface);
    const tree = await ui.drawn();
    expect(textsUnder(tree, 'commands'), surface).toEqual([]);
    const loop = textsUnder(tree, 'loop').join('\n');
    for (const stage of ['Setup', 'Plan', 'Design', 'Build', 'Deploy']) expect(loop, surface).toContain(stage);
    expect(loop, surface).toMatch(/\/forge-sdlc:init/);
    expect(loop, surface).toMatch(/\/forge-sdlc:wayfinder/);
    expect(loop, surface).toMatch(/\/forge-sdlc:build/);
    // where the driver is needed: the setup answers, then the four gates
    const you = loop.split('\n').filter((l) => l.includes('you:'));
    expect(you.length, surface).toBe(5);
    for (const gate of [1, 2, 3, 4]) expect(you.join('\n'), surface).toContain(`Gate ${gate}:`);
    expect(you.join('\n'), surface).toMatch(/\/forge-sdlc:wayfinder <slug> resumes/);
    expect(you.join('\n'), surface).toMatch(/code owner/);
    expect(textsUnder(tree, 'gates').join(' '), surface).toMatch(/gate policy.*Gate 4 is always/);
    await ui.unmount();
  }
});

test('the c and l Buttons switch between the commands and the loop', async ($, on) => {
  seat(on);
  await start($);
  await forge($);
  const ui = await mount($, 'terminal');
  await ui.press({ key: 'loop-tab' });
  expect(textsUnder(await ui.drawn(), 'loop').length).toBeGreaterThan(0);
  expect(textsUnder(await ui.drawn(), 'commands')).toEqual([]);
  await ui.press({ key: 'commands-tab' });
  expect(textsUnder(await ui.drawn(), 'commands').length).toBeGreaterThan(0);
  await ui.unmount();
});

test('an unknown /forge argument answers the usage and opens nothing', async ($, on) => {
  const s = seat(on);
  await start($);
  const ran = await forge($, 'everything');
  expect(ran.text).toMatch(/^Usage: \/forge \[loop \| agents \| close\]/);
  expect(s.opens).toEqual([]);
});

test("a missing skills folder still opens the panel, with the mod's own commands", async ($, on) => {
  seat(on, {});
  await start($);
  await forge($);
  const ui = await mount($, 'terminal');
  const tree = await ui.drawn();
  expect(textsUnder(tree, 'group-Tools').join('\n')).toMatch(/\/forge-pane/);
  expect(textsUnder(tree, 'commands').join('\n')).toMatch(/no skills found/);
  expect(textsUnder(tree, 'actions').join('\n')).not.toMatch(/mattpocock-skills/); // no release found: no m Button
  await ui.unmount();
});

test('/forge agents lists the plugin agents by subagent type, with model, effort and first sentence', async ($, on) => {
  seat(on);
  await start($);
  await forge($, 'agents');
  for (const surface of SURFACES) {
    const ui = await mount($, surface);
    const tree = await ui.drawn();
    expect(textsUnder(tree, 'commands'), surface).toEqual([]);
    const agents = textsUnder(tree, 'agents').join('\n');
    expect(agents, surface).toMatch(
      /forge-sdlc:merger\n {2}claude-sonnet-5-5 · low\n {2}Takes one finished slice from evidence to merge\./,
    );
    expect(agents, surface).toMatch(/forge-sdlc:reviewer\n {2}claude-opus-5-5 · high\n {2}Reviews one axis of one slice\./);
    expect(agents, surface).not.toMatch(/More\.|notes/); // the first sentence; .md files only
    expect(agents.indexOf('merger'), surface).toBeLessThan(agents.indexOf('reviewer')); // by name
    await ui.unmount();
  }
});

test('the a Button switches to the agents', async ($, on) => {
  seat(on);
  await start($);
  await forge($);
  const ui = await mount($, 'terminal');
  await ui.press({ key: 'agents-tab' });
  expect(textsUnder(await ui.drawn(), 'agents').join('\n')).toMatch(/forge-sdlc:merger/);
  await ui.unmount();
});

test('/forge-sdlc:help opens the panel on the commands and asks the model only to point at it', async ($, on) => {
  const s = seat(on);
  on('skill.prompt', () => ({ text: 'the skill body as the engine computes it' })); // the engine ignores e.text
  await start($);
  const prompt = await $.skill.prompt({ skill: 'forge-sdlc:help', text: 'the skill body' });
  expect(s.opens).toEqual([{ id: PANE, focus: true }]);
  expect(prompt.text).toMatch(/^The forge panel is open: the commands \(c\), the agents \(a\) and how the loop runs \(l\)/);
  expect(prompt.text).toMatch(/do not list the commands or agents/);
  const ui = await mount($, 'terminal');
  expect(textsUnder(await ui.drawn(), 'commands').length).toBeGreaterThan(0);
  await ui.unmount();
  // another plugin's help skill is left alone
  const other = await $.skill.prompt({ skill: 'other:help', text: 'x' });
  expect(other.text).toBe('the skill body as the engine computes it');
  expect(s.opens).toHaveLength(1);
});

test('Esc closes the panel while it has the focus, and /forge close closes it from the prompt', async ($, on) => {
  const s = seat(on);
  await start($);
  await forge($);
  expect(s.escapes).toEqual([true]);
  const ran = await forge($, 'close');
  expect(ran.text).toBe('forge panel closed.');
  expect(s.closes).toEqual([PANE]);
  expect(s.opens).toHaveLength(1); // close opens nothing
});
