// The workflow: knobs of the shared roster reader (plugins/forge-sdlc/hooks/roster.mjs):
// resolveRoster reads `workflow:` in docs/agents/forge.yaml, merges it with forge.md's
// deprecated `## Gates` in the spec's precedence order, and reports bad keys, bad values
// and one deprecation line per `## Gates` bullet. Expected values come from the spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveRoster } from '../plugins/forge-sdlc/hooks/roster.mjs';
import { parseForgeConfig } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';

const yaml = (...lines) => ['version: 1', ...lines].join('\n');
const forgeMd = (...lines) => parseForgeConfig(['# forge', '', ...lines].join('\n'));

const DEFAULT_WORKFLOW = {
  policy: 'attended',
  maxParallelSlices: 3,
  gates: { intent: 'attended', spec: 'attended', plan: 'attended' },
  sources: { policy: 'default', maxParallelSlices: 'default', intent: 'default', spec: 'default', plan: 'default' },
};

test('no forge.yaml and no ## Gates yields today’s defaults: every gate attended, 3 slices at once', () => {
  const r = resolveRoster(undefined, undefined);
  assert.deepEqual(r.workflow, DEFAULT_WORKFLOW);
  assert.deepEqual(r.problems, []);
});

test('every workflow: knob is read from forge.yaml, each with its source', () => {
  const r = resolveRoster(
    yaml('workflow:', '  policy: autonomous', '  max_parallel_slices: 5', '  gates:', '    intent: attended', '    spec: policy', '    plan: attended'),
    undefined,
  );
  assert.deepEqual(r.workflow, {
    policy: 'autonomous',
    maxParallelSlices: 5,
    gates: { intent: 'attended', spec: 'policy', plan: 'attended' },
    sources: {
      policy: 'workflow.policy in forge.yaml',
      maxParallelSlices: 'workflow.max_parallel_slices in forge.yaml',
      intent: 'gates.intent in forge.yaml',
      spec: 'gates.spec in forge.yaml',
      plan: 'gates.plan in forge.yaml',
    },
  });
  assert.deepEqual(r.problems, []);
});

test('every workflow: key is optional: one gate set, the rest from the global policy', () => {
  const r = resolveRoster(yaml('workflow:', '  gates:', '    plan: attended'), undefined);
  assert.deepEqual(r.workflow.gates, { intent: 'attended', spec: 'attended', plan: 'attended' });
  assert.deepEqual(r.workflow.sources, { policy: 'default', maxParallelSlices: 'default', intent: 'default', spec: 'default', plan: 'gates.plan in forge.yaml' });
  const p = resolveRoster(yaml('workflow:', '  policy: autonomous'), undefined).workflow;
  assert.deepEqual(p.gates, { intent: 'policy', spec: 'policy', plan: 'policy' });
  assert.equal(p.maxParallelSlices, 3);
  assert.equal(p.sources.plan, 'workflow.policy in forge.yaml');
});

test('workflow is a roster key: an empty workflow: section is no problem and changes nothing', () => {
  const r = resolveRoster(yaml('workflow:'), undefined);
  assert.deepEqual(r.workflow, DEFAULT_WORKFLOW);
  assert.deepEqual(r.problems, []);
});
