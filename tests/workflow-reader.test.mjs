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

// The precedence of a gate's mode, first match wins, one case per row of the spec's table.
const GATES_MD = (...bullets) => forgeMd('## Gates', ...bullets.map((b) => `- ${b}`));

test('precedence 1: gates.<key> in forge.yaml wins over workflow.policy and every ## Gates bullet', () => {
  const r = resolveRoster(
    yaml('workflow:', '  policy: autonomous', '  gates:', '    spec: attended'),
    GATES_MD('policy: autonomous', 'spec: only-on-open'),
  ).workflow;
  assert.equal(r.gates.spec, 'attended');
  assert.equal(r.sources.spec, 'gates.spec in forge.yaml');
});

test('precedence 2: ## Gates spec: only-on-open makes Gate 2 policy when forge.yaml sets neither workflow.policy nor gates.spec', () => {
  for (const text of [undefined, yaml('workflow:', '  gates:', '    plan: attended')]) {
    const r = resolveRoster(text, GATES_MD('policy: attended', 'spec: only-on-open')).workflow;
    assert.equal(r.gates.spec, 'policy');
    assert.equal(r.sources.spec, 'spec in forge.md ## Gates');
    assert.equal(r.gates.intent, 'attended');
    assert.equal(r.sources.intent, 'policy in forge.md ## Gates');
  }
  const set = resolveRoster(yaml('workflow:', '  policy: attended'), GATES_MD('spec: only-on-open')).workflow;
  assert.equal(set.gates.spec, 'attended');
  assert.equal(set.sources.spec, 'workflow.policy in forge.yaml');
});

test('precedence 3a: workflow.policy in forge.yaml wins over ## Gates policy', () => {
  const r = resolveRoster(yaml('workflow:', '  policy: attended'), GATES_MD('policy: autonomous')).workflow;
  assert.equal(r.policy, 'attended');
  assert.deepEqual(r.gates, { intent: 'attended', spec: 'attended', plan: 'attended' });
  assert.equal(r.sources.policy, 'workflow.policy in forge.yaml');
  assert.equal(r.sources.plan, 'workflow.policy in forge.yaml');
});

test('precedence 3b: ## Gates policy decides when forge.yaml sets no policy; autonomous gives mode policy, anything else attended', () => {
  const auto = resolveRoster(undefined, GATES_MD('policy: autonomous')).workflow;
  assert.equal(auto.policy, 'autonomous');
  assert.deepEqual(auto.gates, { intent: 'policy', spec: 'policy', plan: 'policy' });
  assert.equal(auto.sources.policy, 'policy in forge.md ## Gates');
  assert.equal(auto.sources.intent, 'policy in forge.md ## Gates');
  const other = resolveRoster(yaml('workflow:', '  max_parallel_slices: 2'), GATES_MD('policy: sometimes')).workflow;
  assert.equal(other.policy, 'attended');
  assert.deepEqual(other.gates, { intent: 'attended', spec: 'attended', plan: 'attended' });
  assert.equal(other.sources.spec, 'policy in forge.md ## Gates');
});

test('precedence 3c: with neither file setting a policy every gate is attended by default', () => {
  const r = resolveRoster(yaml('workflow:', '  max_parallel_slices: 2'), GATES_MD('max_parallel_slices: 4')).workflow;
  assert.deepEqual(r.gates, { intent: 'attended', spec: 'attended', plan: 'attended' });
  assert.equal(r.sources.policy, 'default');
  assert.equal(r.sources.spec, 'default');
});

test('max_parallel_slices: forge.yaml, else ## Gates, else 3', () => {
  const both = resolveRoster(yaml('workflow:', '  max_parallel_slices: 2'), GATES_MD('max_parallel_slices: 4')).workflow;
  assert.equal(both.maxParallelSlices, 2);
  assert.equal(both.sources.maxParallelSlices, 'workflow.max_parallel_slices in forge.yaml');
  const md = resolveRoster(undefined, GATES_MD('max_parallel_slices: 4')).workflow;
  assert.equal(md.maxParallelSlices, 4);
  assert.equal(md.sources.maxParallelSlices, 'max_parallel_slices in forge.md ## Gates');
});

test('workflow is a roster key: an empty workflow: section is no problem and changes nothing', () => {
  const r = resolveRoster(yaml('workflow:'), undefined);
  assert.deepEqual(r.workflow, DEFAULT_WORKFLOW);
  assert.deepEqual(r.problems, []);
});
