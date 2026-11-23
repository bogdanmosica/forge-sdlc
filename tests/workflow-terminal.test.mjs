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
