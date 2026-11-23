// The terminal loop layout (loopRows in hooks/forge/help.ts): the resolved
// workflow from the shared reader, laid out at a width, as the /forge loop tab
// draws it. Node strips help.ts's types on import; it has no imports of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const plugin = (p) => fileURLToPath(new URL(`../plugins/forge-sdlc/${p}`, import.meta.url));
const { loopRows } = await import('../plugins/forge-sdlc/hooks/forge/help.ts');
const { resolveRoster, resolveWorkflow } = await import('../plugins/forge-sdlc/hooks/roster.mjs');
const workflowText = readFileSync(plugin('workflow.yaml'), 'utf8');

// The loop for an effort record, under a host roster (forge.yaml text).
const loop = (effort, forgeYaml) =>
  resolveWorkflow(workflowText, resolveRoster(forgeYaml, undefined), effort ? { effort } : {});
const at = (stage, gate, stop = 'none', risk = 'normal') => ({ slug: 'demo', stage, gate, stop, risk });
const texts = (rows) => rows.map((r) => r.text);

test('at 72 columns passed stages fold to one line with their gate at the right, the current stage is a box', () => {
  const rows = loopRows(loop(at('plan', 'plan', 'open')), 72);
  for (const r of rows) assert.equal(r.text.length, 72, `every row is 72 wide: "${r.text}"`);
  const t = texts(rows);
  const intent = t.find((x) => x.startsWith('✓ intent'));
  assert.ok(intent, 'intent folds to one line');
  assert.match(intent, /Gate 1 ✓ attended$/);
  assert.ok(t.some((x) => x.startsWith('✓ spec') && x.endsWith('Gate 2 ✓ attended')));
  assert.ok(t.some((x) => x.startsWith('✓ map ') && !/Gate/.test(x)), 'map has no gate');
  assert.equal(rows.find((r) => r.text.startsWith('✓ intent')).tone, 'passed');
  const top = rows.find((r) => r.text.startsWith('╭─ plan '));
  assert.ok(top, 'plan is a box');
  assert.match(top.text, /▶ here ╮$/);
  assert.equal(top.tone, 'current');
  assert.ok(t.some((x) => x.startsWith('╭─ build ') && !x.includes('▶')), 'build, ahead, is a box');
  assert.ok(!t.some((x) => x.startsWith('╭─ spec ')), 'spec, passed, is no box');
});

test('at 52 columns the gate sits in the bottom border, its text cut to fit, and the legend wraps whole', () => {
  const autonomous = 'version: 1\nworkflow:\n  policy: autonomous\n';
  const rows = loopRows(loop(at('intent', 'intent'), autonomous), 52);
  for (const r of rows) assert.equal(r.text.length, 52, `every row is 52 wide: "${r.text}"`);
  const t = texts(rows);
  const spec = t.find((x) => x.startsWith('╰─ ○ Gate 2'));
  assert.equal(spec, '╰─ ○ Gate 2 · policy · stops on open · flagged ·… ─╯');
  assert.ok(t.some((x) => /^╰─ ○ Gate 4 · owner · always stops ─+╯$/.test(x)), 'the owner gate in the border');
  assert.ok(t.some((x) => x.startsWith('╰─ ▶ Gate 1 · policy · waiting ─')), 'the gate the effort is at waits');
  assert.ok(t.includes('⇄ swapped in forge.yaml'.padEnd(52)), 'the legend wraps at an entry');
  assert.ok(t.some((x) => x.startsWith('│ implementer  forge-sdlc:implementer ')), 'with no model, the agent has the room');
});

test("a stopped gate adds why: from its stop reason and resume:, and only attended names its setting's source", () => {
  const line = (rows, label) => rows.find((r) => r.text.startsWith(`  ${label}: `));
  const open = loopRows(loop(at('plan', 'plan', 'open')), 72);
  assert.equal(line(open, 'why').text.trimEnd(), '  why: an open: line in plan.md');
  assert.equal(line(open, 'why').tone, 'note');
  assert.equal(line(open, 'resume').text.trimEnd(), '  resume: /forge-sdlc:wayfinder demo');
  const ix = open.findIndex((r) => r.text.startsWith('╰─ ■ Gate 3'));
  assert.deepEqual(texts(open.slice(ix + 1, ix + 3)).map((x) => x.trim().split(':')[0]), ['why', 'resume'], 'under the gate');
  const flagged = loopRows(loop(at('spec', 'spec', 'flagged')), 72);
  assert.equal(line(flagged, 'why').text.trimEnd(), '  why: a flagged concern in spec.md');
  const risky = loopRows(loop(at('intent', 'intent', 'risk-high', 'high')), 72);
  assert.equal(line(risky, 'why').text.trimEnd(), '  why: risk: high, every gate attended');
  const attended = loopRows(loop(at('plan', 'plan', 'attended'), 'version: 1\nworkflow:\n  gates:\n    plan: attended\n'), 72);
  assert.equal(line(attended, 'why').text.trimEnd(), '  why: attended by gates.plan in forge.yaml');
  for (const rows of [open, flagged, risky]) assert.doesNotMatch(line(rows, 'why').text, /forge\.yaml|forge\.md|default/);
  assert.equal(line(loopRows(loop(at('plan', 'plan')), 72), 'why'), undefined, 'a waiting gate has no why:');
});

test('below 52 columns one line per stage, its gate on the line under it, down to the 24-column floor', () => {
  const wf = loop(at('plan', 'plan', 'attended'), 'version: 1\nworkflow:\n  gates:\n    plan: attended\n');
  for (const [columns, width] of [[51, 51], [24, 24], [10, 24]]) {
    const rows = loopRows(wf, columns);
    for (const r of rows) assert.equal(r.text.length, width, `${columns}: every row is ${width} wide: "${r.text}"`);
    const t = texts(rows);
    assert.ok(!t.some((x) => /[╭╰│]/.test(x)), `${columns}: no boxes`);
    const stages = t.filter((x) => /^[✓▶○] [a-z]/.test(x)).map((x) => x.slice(2).trim());
    assert.deepEqual(stages, ['map', 'intent', 'spec', 'plan', 'build', 'built'], `${columns}: one line per stage`);
    assert.equal(rows.find((r) => r.text.startsWith('▶ plan')).tone, 'current');
    assert.equal(rows.find((r) => r.text.startsWith('✓ spec')).tone, 'passed');
    const gate = rows.find((r) => r.text.startsWith('■   G3'));
    assert.equal(gate.text.trimEnd(), '■   G3 attended');
    assert.equal(gate.tone, 'stopped');
    const below = texts(rows.slice(rows.indexOf(gate) + 1, rows.indexOf(gate) + 3));
    assert.match(below[0], /^ {2}why: attended by/);
    assert.match(below[1], /^ {2}resume: /);
    assert.ok(t.some((x) => x.startsWith('○   G4 owner')));
    assert.ok(t.some((x) => x.startsWith('✓   G1 attended')));
  }
  assert.equal(loopRows(wf, 51)[0].text.trimEnd(), 'demo');
});
