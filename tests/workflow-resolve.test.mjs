// resolveWorkflow in the shared reader (plugins/forge-sdlc/hooks/roster.mjs): the plugin's
// workflow.yaml joined with the resolved roster, the agents' frontmatter models and an
// effort's record. Expected values come from the spec and the shipped file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveRoster, resolveWorkflow } from '../plugins/forge-sdlc/hooks/roster.mjs';

const SHIPPED = readFileSync(new URL('../plugins/forge-sdlc/workflow.yaml', import.meta.url), 'utf8');
const yaml = (...lines) => ['version: 1', ...lines].join('\n');
const MODELS = {
  'forge-sdlc:researcher': 'sonnet',
  'forge-sdlc:prototyper': 'sonnet',
  'forge-sdlc:spec-writer': 'opus',
  'forge-sdlc:implementer': 'opus',
  'forge-sdlc:verifier': 'haiku',
  'forge-sdlc:reviewer': 'opus',
  'forge-sdlc:merger': 'sonnet',
};
const byName = (w) => Object.fromEntries(w.stages.map((s) => [s.name, s]));

test('the defaults: stages in order, roles with their frontmatter models, slots with their skills, every gate attended by default and Gate 4 the owner’s', () => {
  const w = resolveWorkflow(SHIPPED, resolveRoster(undefined, undefined), { agentModels: MODELS });
  assert.deepEqual(w.problems, []);
  assert.equal(w.policy, 'attended');
  assert.equal(w.maxParallelSlices, 3);
  assert.deepEqual(w.stages.map((s) => s.name), ['map', 'intent', 'spec', 'plan', 'build', 'built']);
  const s = byName(w);
  assert.deepEqual(s.map, {
    name: 'map',
    does: 'the map and its tickets, worked with the owner',
    command: '/forge-sdlc:wayfinder',
    roles: [
      { role: 'researcher', agent: 'forge-sdlc:researcher', model: 'sonnet', swapped: false },
      { role: 'prototyper', agent: 'forge-sdlc:prototyper', model: 'sonnet', swapped: false },
    ],
    slots: [
      { slot: 'grilling', skill: 'mattpocock-skills:grilling' },
      { slot: 'prototyper.prototype', skill: 'mattpocock-skills:prototype' },
      { slot: 'domain-modeling', skill: 'mattpocock-skills:domain-modeling' },
    ],
  });
  assert.deepEqual(s.spec.slots, [
    { slot: 'spec-writer.codebase-design', skill: 'mattpocock-skills:codebase-design' },
    { slot: 'policy', skill: 'none' },
  ]);
  assert.deepEqual(s.intent.gate, { key: 'intent', n: 1, artifact: 'intent.md', stops: ['open', 'risk-high', 'attended'], mode: 'attended', source: 'default' });
  assert.deepEqual(s.spec.gate, { key: 'spec', n: 2, artifact: 'spec.md', stops: ['open', 'flagged', 'risk-high', 'attended'], mode: 'attended', source: 'default' });
  assert.deepEqual(s.plan.gate, { key: 'plan', n: 3, artifact: 'plan.md', stops: ['open', 'risk-high', 'attended'], mode: 'attended', source: 'default' });
  assert.deepEqual(s.build.gate, { key: 'pr', n: 4, artifact: 'the PR', stops: [], mode: 'owner', source: 'always' });
  assert.deepEqual(s.built, { name: 'built', does: 'ready for review; the code owner merges', roles: [], slots: [] });
});

test('roles resolve through a swapped roster: the swapped agent, the roster’s model over the frontmatter, its effort; host knobs set each gate', () => {
  const roster = resolveRoster(
    yaml(
      'roles:',
      '  implementer:',
      '    agent: my-team:builder',
      '    model: sonnet',
      '  spec-writer:',
      '    effort: high',
      '  reviewer:',
      '    agent: my-team:critic',
      'slots:',
      '  implementer.tdd: my-team:tdd',
      '  policy: [house-rules, security-review]',
      'workflow:',
      '  policy: autonomous',
      '  max_parallel_slices: 5',
      '  gates:',
      '    plan: attended',
    ),
    undefined,
  );
  const w = resolveWorkflow(SHIPPED, roster, { agentModels: MODELS });
  assert.deepEqual(w.problems, []);
  assert.equal(w.policy, 'autonomous');
  assert.equal(w.maxParallelSlices, 5);
  const s = byName(w);
  assert.deepEqual(s.build.roles, [
    { role: 'implementer', agent: 'my-team:builder', model: 'sonnet', swapped: true },
    { role: 'verifier', agent: 'forge-sdlc:verifier', model: 'haiku', swapped: false },
    { role: 'reviewer', agent: 'my-team:critic', swapped: true },
    { role: 'merger', agent: 'forge-sdlc:merger', model: 'sonnet', swapped: false },
  ]);
  assert.deepEqual(s.spec.roles, [{ role: 'spec-writer', agent: 'forge-sdlc:spec-writer', model: 'opus', effort: 'high', swapped: false }]);
  assert.deepEqual(s.build.slots, [{ slot: 'implementer.tdd', skill: 'my-team:tdd' }]);
  assert.deepEqual(s.spec.slots[1], { slot: 'policy', skill: 'house-rules, security-review' });
  assert.deepEqual(
    w.stages.filter((x) => x.gate).map((x) => [x.gate.key, x.gate.mode, x.gate.source]),
    [
      ['intent', 'policy', 'workflow.policy in forge.yaml'],
      ['spec', 'policy', 'workflow.policy in forge.yaml'],
      ['plan', 'attended', 'gates.plan in forge.yaml'],
      ['pr', 'owner', 'always'],
    ],
  );
});

test('without agentModels a role the roster gives no model has none', () => {
  const w = resolveWorkflow(SHIPPED, resolveRoster(undefined, undefined));
  assert.deepEqual(byName(w).map.roles[0], { role: 'researcher', agent: 'forge-sdlc:researcher', swapped: false });
});

// Where an effort stands, for each stage and stop it can record (docs/contracts.md:
// `gate` is the gate the effort waits at, `none` while a stage runs).
const POSITIONS = [
  // [stage, gate, stop, stage statuses map…built, gate statuses intent, spec, plan, pr]
  ['map', 'none', undefined, ['current', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead'], ['ahead', 'ahead', 'ahead', 'ahead']],
  ['intent', 'intent', undefined, ['passed', 'current', 'ahead', 'ahead', 'ahead', 'ahead'], ['waiting', 'ahead', 'ahead', 'ahead']],
  ['intent', 'intent', 'open', ['passed', 'current', 'ahead', 'ahead', 'ahead', 'ahead'], ['stopped', 'ahead', 'ahead', 'ahead']],
  ['spec', 'spec', undefined, ['passed', 'passed', 'current', 'ahead', 'ahead', 'ahead'], ['passed', 'waiting', 'ahead', 'ahead']],
  ['spec', 'spec', 'flagged', ['passed', 'passed', 'current', 'ahead', 'ahead', 'ahead'], ['passed', 'stopped', 'ahead', 'ahead']],
  ['plan', 'plan', undefined, ['passed', 'passed', 'passed', 'current', 'ahead', 'ahead'], ['passed', 'passed', 'waiting', 'ahead']],
  ['plan', 'plan', 'risk-high', ['passed', 'passed', 'passed', 'current', 'ahead', 'ahead'], ['passed', 'passed', 'stopped', 'ahead']],
  ['plan', 'plan', 'attended', ['passed', 'passed', 'passed', 'current', 'ahead', 'ahead'], ['passed', 'passed', 'stopped', 'ahead']],
  ['build', 'none', undefined, ['passed', 'passed', 'passed', 'passed', 'current', 'ahead'], ['passed', 'passed', 'passed', 'ahead']],
  ['built', 'pr', undefined, ['passed', 'passed', 'passed', 'passed', 'passed', 'current'], ['passed', 'passed', 'passed', 'waiting']],
];

for (const [stage, gate, stop, stageStatus, gateStatus] of POSITIONS) {
  test(`an effort at stage ${stage}, gate ${gate}${stop ? `, stop ${stop}` : ''}: stages ${stageStatus.join(' ')}; gates ${gateStatus.join(' ')}`, () => {
    const effort = { slug: 'demo', stage, gate, risk: 'normal', ...(stop ? { stop } : {}) };
    const w = resolveWorkflow(SHIPPED, resolveRoster(undefined, undefined), { effort });
    assert.deepEqual(w.stages.map((s) => s.status), stageStatus);
    assert.deepEqual(w.stages.filter((s) => s.gate).map((s) => s.gate.status), gateStatus);
    assert.deepEqual(w.effort, { slug: 'demo', stage, gate, stop: stop ?? 'none', risk: 'normal' });
  });
}

test('without an effort, or with a stage the loop does not know, nothing is positioned', () => {
  for (const effort of [undefined, { slug: 'demo', stage: 'shipping', gate: 'none' }, 'plan']) {
    const w = resolveWorkflow(SHIPPED, resolveRoster(undefined, undefined), { effort });
    assert.equal(w.effort, null);
    assert.ok(w.stages.every((s) => !('status' in s) && !(s.gate && 'status' in s.gate)));
  }
});

test('a stop outside the closed set reads as none: the gate waits', () => {
  const w = resolveWorkflow(SHIPPED, resolveRoster(undefined, undefined), { effort: { slug: 'demo', stage: 'spec', gate: 'spec', stop: 'lunch' } });
  assert.equal(byName(w).spec.gate.status, 'waiting');
  assert.equal(w.effort.stop, 'none');
});

test('risk: high shows every gate attended with source risk: high, whatever the settings; Gate 4 stays the owner’s', () => {
  const roster = resolveRoster(yaml('workflow:', '  policy: autonomous', '  gates:', '    spec: policy'), undefined);
  const w = resolveWorkflow(SHIPPED, roster, { effort: { slug: 'demo', stage: 'spec', gate: 'spec', stop: 'risk-high', risk: 'high' } });
  assert.deepEqual(
    w.stages.filter((s) => s.gate).map((s) => [s.gate.key, s.gate.mode, s.gate.source]),
    [
      ['intent', 'attended', 'risk: high'],
      ['spec', 'attended', 'risk: high'],
      ['plan', 'attended', 'risk: high'],
      ['pr', 'owner', 'always'],
    ],
  );
  assert.equal(w.policy, 'autonomous');
  assert.equal(w.effort.risk, 'high');
});

test('risk: normal leaves the settings’ modes', () => {
  const roster = resolveRoster(yaml('workflow:', '  policy: autonomous'), undefined);
  const w = resolveWorkflow(SHIPPED, roster, { effort: { slug: 'demo', stage: 'spec', gate: 'spec', risk: 'normal' } });
  assert.deepEqual(byName(w).spec.gate.mode, 'policy');
});

// A malformed workflow.yaml is a problem and the loop falls back to the fixed stages.
const MALFORMED = {
  'no file': undefined,
  'an empty file': '',
  'a YAML error': SHIPPED.replace('version: 1', 'version: 1\n\tstray: tab'),
  'not a map': '- map\n- intent',
  'version 2': SHIPPED.replace('version: 1', 'version: 2'),
  'stages reordered': SHIPPED.replace(/  map:[\s\S]*?(?=  intent:)/, '').replace('  built:', '  built:\n    does: x\n  map:\n    does: y'),
  'a stage the loop does not have': SHIPPED.replace('  built:', '  deploy:\n    does: ship it\n  built:'),
  'a role the roster does not know': SHIPPED.replace('roles: [spec-writer]', 'roles: [spec-writer, architect]'),
  'a slot the roster does not know': SHIPPED.replace('slots: [implementer.tdd]', 'slots: [implementer.tdd, reviewer.lint]'),
  'a gate under the wrong key': SHIPPED.replace('key: plan', 'key: quiz'),
  'a gate on a stage that has none': SHIPPED.replace('    end: true', '    gate:\n      n: 5\n      key: ship\n      artifact: x\n      stops: [open]'),
  'a stop outside the closed set': SHIPPED.replace('stops: [open, risk-high, attended]', 'stops: [open, lunch]'),
  'a stage key it does not read': SHIPPED.replace('    end: true', '    end: true\n    order: 7'),
};

for (const [what, text] of Object.entries(MALFORMED)) {
  test(`${what}: a workflow.yaml problem, and the fixed stages`, () => {
    const roster = resolveRoster(undefined, undefined);
    const w = resolveWorkflow(text, roster, { agentModels: MODELS });
    assert.ok(w.problems.length > 0, 'a problem is reported');
    assert.ok(w.problems.every((p) => p.startsWith('workflow.yaml: ')), w.problems.join('\n'));
    assert.deepEqual(w.stages, resolveWorkflow(SHIPPED, roster, { agentModels: MODELS }).stages);
  });
}

test('the fixed stages are the shipped file’s: the fallback and the file resolve alike', () => {
  const roster = resolveRoster(undefined, undefined);
  const effort = { slug: 'demo', stage: 'plan', gate: 'plan', stop: 'open' };
  const fallback = resolveWorkflow('', roster, { agentModels: MODELS, effort });
  const shipped = resolveWorkflow(SHIPPED, roster, { agentModels: MODELS, effort });
  assert.deepEqual(fallback.stages, shipped.stages);
  assert.deepEqual(shipped.problems, []);
});

test('the roster’s problems, workflow: ones included, come first in problems', () => {
  const roster = resolveRoster(yaml('workflow:', '  gates:', '    pr: policy'), undefined);
  const w = resolveWorkflow('', roster);
  assert.equal(w.problems[0], 'roster: workflow.gates.pr is not a setting: Gate 4 is always the code owner’s; ignored');
  assert.ok(w.problems.slice(1).every((p) => p.startsWith('workflow.yaml: ')));
});

test('it never throws, whatever it is given, and still returns the whole loop', () => {
  const texts = [undefined, null, 42, {}, 'stages:\n  map: 1', SHIPPED];
  const rosters = [undefined, null, 42, {}, { roles: 'x', workflow: [] }, resolveRoster(undefined, undefined)];
  const options = [undefined, null, 42, { agentModels: 7, effort: 'plan' }, { agentModels: { 'forge-sdlc:merger': 'nonsense' }, effort: { stage: 'plan', gate: {}, stop: [] } }];
  for (const t of texts)
    for (const r of rosters)
      for (const o of options) {
        const w = resolveWorkflow(t, r, o);
        assert.deepEqual(w.stages.map((s) => s.name), ['map', 'intent', 'spec', 'plan', 'build', 'built']);
      }
});

test('the reader stays pure: no imports, no require, no Node API', () => {
  const source = readFileSync(new URL('../plugins/forge-sdlc/hooks/roster.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /\bimport\(|\brequire\(|\bprocess\.|\bBuffer\b|\bglobalThis\b/);
});
