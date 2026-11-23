// The /forge loop tab drawing the loop (terminal B, forge/help.ts loopRows),
// through `claude plugin test`: the plugin's workflow.yaml through the shared
// reader, the host's forge.yaml, and the newest map under docs/efforts
// positioned from .forge/state.json. The test answers the files from a virtual
// tree and reads the drawing back by key.
import { test, expect, mock } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On } from 'claude-code';
import { SURFACES, textsUnder } from './run-pane.fixture';

const PANE = 'forge';

// The plugin's workflow.yaml as it ships, in the shape the reader holds it to.
const WORKFLOW = [
  'version: 1',
  'stops: [open, flagged, risk-high, attended]',
  'stages:',
  '  map:',
  '    does: the map and its tickets, worked with the owner',
  '    command: /forge-sdlc:wayfinder',
  '    roles: [researcher, prototyper]',
  '    slots: [grilling, prototyper.prototype, domain-modeling]',
  '  intent:',
  '    does: intent.md and the draft PR',
  '    command: /forge-sdlc:wayfinder',
  '    roles: []',
  '    slots: []',
  '    gate:',
  '      n: 1',
  '      key: intent',
  '      artifact: intent.md',
  '      stops: [open, risk-high, attended]',
  '  spec:',
  '    does: spec.md under the policy skills',
  '    command: /forge-sdlc:spec',
  '    roles: [spec-writer]',
  '    slots: [spec-writer.codebase-design, policy]',
  '    gate:',
  '      n: 2',
  '      key: spec',
  '      artifact: spec.md',
  '      stops: [open, flagged, risk-high, attended]',
  '  plan:',
  '    does: plan.md, slices, the quiz',
  '    command: /forge-sdlc:plan',
  '    roles: []',
  '    slots: []',
  '    gate:',
  '      n: 3',
  '      key: plan',
  '      artifact: plan.md',
  '      stops: [open, risk-high, attended]',
  '  build:',
  '    does: one worktree per slice, merged when clean',
  '    command: /forge-sdlc:build',
  '    roles: [implementer, verifier, reviewer, merger]',
  '    slots: [implementer.tdd]',
  '    gate:',
  '      n: 4',
  '      key: pr',
  '      artifact: the PR',
  '      owner: always',
  '  built:',
  '    does: ready for review; the code owner merges',
  '    end: true',
  '',
].join('\n');

const ATTENDED_PLAN = ['version: 1', 'workflow:', '  gates:', '    plan: attended', ''].join('\n');
const MAP = '# Map: demo\n';
const state = (efforts: Record<string, unknown>) => JSON.stringify({ version: 1, efforts });

// A virtual tree: the plugin's files under `forge-sdlc/...` wherever the kit
// puts its root, the host's files by their path below the session folder (the
// kit may resolve them under the plugin root: the host's path wins). A key is a
// file; a prefix of a key is a folder.
function seat(on: On, files: Record<string, string>): void {
  mock.env(on, { HOME: '/home' });
  const norm = (p: string) =>
    (p.match(/(?:^|\/)((?:docs|\.forge|\.scratch)\/.*)$/)?.[1] ?? p.match(/(forge-sdlc(?:\/.*)?)$/)?.[1] ?? p).replace(/\/$/, '');
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('command.register', ($, e) => ({ value: { command: e.name } }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.close', () => ({ value: undefined }));
  on('ui.status', () => ({ value: undefined }));
  on('fs.list', ($, e) => {
    const dir = norm(e.path);
    const names = new Map<string, 'file' | 'dir'>();
    for (const k of Object.keys(files).filter((k) => k.startsWith(`${dir}/`))) {
      const rest = k.slice(dir.length + 1).split('/');
      names.set(rest[0]!, rest.length === 1 ? 'file' : 'dir');
    }
    if (names.size === 0) throw new Error(`ENOENT: ${e.path}`);
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })) };
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

const forge = ($: Engine, args = 'loop') =>
  $.command.run({
    command: 'forge',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  });

const mount = ($: Engine, surface: (typeof SURFACES)[number], bodyColumns = 80) =>
  $.ui.mount({
    plugin: 'forge-sdlc',
    surface,
    component: 'Pane',
    requestId: PANE,
    props: {
      title: 'forge',
      isFocused: true,
      bodyColumns,
      placement: 'inline' as const,
      scroll: { offset: 0, bodyRows: 80 },
      view: {},
    },
    viewport: { columns: 120, rows: 90, isFullscreen: true },
  });

test("the loop tab draws the newest effort: the current stage, and a stopped gate's why and resume", async ($, on) => {
  seat(on, {
    'forge-sdlc/workflow.yaml': WORKFLOW,
    'docs/agents/forge.yaml': ATTENDED_PLAN,
    'docs/efforts/demo/map.md': MAP,
    '.forge/state.json': state({ demo: { stage: 'plan', gate: 'plan', stop: 'attended', risk: 'normal' } }),
  });
  await start($);
  await forge($);
  for (const surface of SURFACES) {
    const ui = await mount($, surface);
    const diagram = textsUnder(await ui.drawn(), 'diagram');
    const text = diagram.join('\n');
    expect(diagram[0], surface).toMatch(/^demo · policy attended/);
    // the passed stages, one line each
    expect(text, surface).toMatch(/^✓ map/m);
    expect(text, surface).toMatch(/^✓ spec .*Gate 2 ✓ attended/m);
    // the current stage is a box, its stopped gate in the bottom border
    expect(text, surface).toMatch(/^╭─ plan ─+ ▶ here ╮$/m);
    expect(text, surface).toMatch(/^╰─ ■ Gate 3 · attended · STOPPED: attended ─+╯$/m);
    expect(text, surface).toMatch(/^ {2}why: attended by gates\.plan in forge\.yaml/m);
    expect(text, surface).toMatch(/^ {2}resume: \/forge-sdlc:wayfinder demo/m);
    // the stages ahead are boxes too
    expect(text, surface).toMatch(/^╭─ build ─+╮$/m);
    await ui.unmount();
  }
});

test('the prose rows stay under the diagram: what runs at each stage and where you are needed', async ($, on) => {
  seat(on, { 'forge-sdlc/workflow.yaml': WORKFLOW });
  await start($);
  await forge($);
  for (const surface of SURFACES) {
    const ui = await mount($, surface);
    const tree = await ui.drawn();
    const loop = textsUnder(tree, 'loop');
    const diagram = textsUnder(tree, 'diagram');
    expect(diagram.length, surface).toBeGreaterThan(0);
    // the diagram first, then the prose
    expect(loop.slice(0, diagram.length), surface).toEqual(diagram);
    const prose = loop.slice(diagram.length);
    expect(prose[0], surface).toBe('Watch');
    for (const stage of ['Setup', 'Plan', 'Design', 'Build', 'Deploy']) expect(prose, surface).toContain(stage);
    expect(prose.filter((l) => l.startsWith('  you: ')).length, surface).toBe(6);
    await ui.unmount();
  }
});

test("the gates' line names forge.yaml's workflow: and the per-gate override", async ($, on) => {
  seat(on, { 'forge-sdlc/workflow.yaml': WORKFLOW });
  await start($);
  await forge($);
  const ui = await mount($, 'terminal');
  const loop = textsUnder(await ui.drawn(), 'loop').join('\n');
  expect(loop).toMatch(/workflow\.policy in docs\/agents\/forge\.yaml/);
  expect(loop).toMatch(/gates\.intent, gates\.spec or gates\.plan/);
  expect(loop).toMatch(/Gate 4 is always the code owner/);
  await ui.unmount();
});

test('below 52 columns the loop is one line per stage, the stopped gate still saying why and how to resume', async ($, on) => {
  seat(on, {
    'forge-sdlc/workflow.yaml': WORKFLOW,
    'docs/agents/forge.yaml': ATTENDED_PLAN,
    'docs/efforts/demo/map.md': MAP,
    '.forge/state.json': state({ demo: { stage: 'plan', gate: 'plan', stop: 'attended', risk: 'normal' } }),
  });
  await start($);
  await forge($);
  for (const surface of SURFACES) {
    const ui = await mount($, surface, 40);
    const diagram = textsUnder(await ui.drawn(), 'diagram');
    const text = diagram.join('\n');
    expect(text, surface).not.toMatch(/[╭╰│]/);
    expect(diagram.every((l) => l.length === 40), surface).toBe(true);
    const stages = diagram.filter((l) => /^[✓▶○] [a-z]+/.test(l)).map((l) => l.trim());
    expect(stages, surface).toEqual(['✓ map', '✓ intent', '✓ spec', '▶ plan', '○ build', '○ built']);
    expect(text, surface).toMatch(/^■ {3}G3 attended/m);
    expect(text, surface).toMatch(/^ {2}why: attended by gates\.plan/m);
    expect(text, surface).toMatch(/^ {2}resume: \/forge-sdlc:wayfinder demo/m);
    await ui.unmount();
  }
});

test('no effort: the loop is drawn unpositioned, every gate with who passes it', async ($, on) => {
  seat(on, { 'forge-sdlc/workflow.yaml': WORKFLOW, 'docs/agents/forge.yaml': ATTENDED_PLAN });
  await start($);
  await forge($);
  for (const surface of SURFACES) {
    const ui = await mount($, surface);
    const text = textsUnder(await ui.drawn(), 'diagram').join('\n');
    expect(text, surface).toMatch(/^the loop · policy attended · ≤3 slices/);
    // no stage passed or here, no gate passed, waiting or stopped (the legend aside)
    expect(text, surface).not.toMatch(/^✓ |▶ here ╮|[✓▶■] Gate/m);
    expect(text, surface).not.toMatch(/why:|resume:/);
    for (const stage of ['map', 'intent', 'spec', 'plan', 'build']) expect(text, surface).toMatch(new RegExp(`^╭─ ${stage} ─+╮$`, 'm'));
    expect(text, surface).toMatch(/^╰─ ○ Gate 3 · attended · always stops ─+╯$/m);
    expect(text, surface).toMatch(/^╰─ ○ Gate 4 · owner · always stops ─+╯$/m);
    await ui.unmount();
  }
});

test('a map with no record in .forge/state.json is the loop unpositioned too', async ($, on) => {
  seat(on, {
    'forge-sdlc/workflow.yaml': WORKFLOW,
    'docs/efforts/demo/map.md': MAP,
    '.forge/state.json': state({ other: { stage: 'build', gate: 'pr', risk: 'normal' } }),
  });
  await start($);
  await forge($);
  const ui = await mount($, 'terminal');
  const text = textsUnder(await ui.drawn(), 'diagram').join('\n');
  expect(text).toMatch(/^the loop · policy attended/);
  expect(text).not.toMatch(/▶ here ╮/);
  await ui.unmount();
});
