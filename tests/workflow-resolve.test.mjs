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
