// The PR body's Workflow section: each stage that rewrites the PR body also rewrites its `## Workflow`
// section after its state write, the output of bin/workflow.mjs --mermaid --effort <slug> in a fenced
// `mermaid` block, every other section verbatim, PR.md without a remote; intent writes it first
// (docs/efforts/workflow-as-code/spec.md, "The stages").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stepOf } from './support/skill.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const skill = (name) => read(`plugins/forge-sdlc/skills/${name}/SKILL.md`);

const MERMAID = 'node "${CLAUDE_PLUGIN_ROOT}/bin/workflow.mjs" --mermaid --effort <slug> --project .';

/** Asserts a step names the `## Workflow` rewrite, after the state write `stateWrite` matches. */
function namesWorkflowAfterStateWrite(step, stateWrite, label) {
  assert.ok(step, `${label}: the step exists`);
  const state = step.search(stateWrite);
  assert.ok(state >= 0, `${label}: the step writes state`);
  const section = step.indexOf('`## Workflow`');
  assert.ok(section >= 0, `${label}: names the ## Workflow section`);
  assert.ok(section > state, `${label}: the ## Workflow rewrite comes after the state write`);
  const rule = step.slice(section);
  assert.ok(rule.includes(MERMAID), `${label}: the section holds bin/workflow.mjs --mermaid --effort <slug>`);
  assert.match(rule, /in a fenced `mermaid` block/, `${label}: in a fenced mermaid block`);
  assert.match(rule, /every other section verbatim/, `${label}: every other section verbatim`);
  assert.match(rule, /Without a remote the section goes into `docs\/efforts\/<slug>\/PR\.md`, committed on `feat\/<slug>`/, `${label}: PR.md without a remote`);
}

test('wayfinder: Gate 1 rewrites ## Workflow after its stop write, the first stage to write it', () => {
  const text = skill('wayfinder');
  namesWorkflowAfterStateWrite(stepOf(text, 7), /A stop writes `stop`/, 'wayfinder step 7');
  assert.doesNotMatch(stepOf(text, 6), /## Workflow/, 'step 6 drafts the PR; the section waits for the gate');
});
