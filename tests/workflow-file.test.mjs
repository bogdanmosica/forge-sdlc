// The plugin's descriptive loop file, plugins/forge-sdlc/workflow.yaml: it parses in the
// forge.yaml YAML subset with no problems, its stages are effort-state.mjs's stages in
// order, its gates are intent, spec, plan and pr, and every role and slot it names is
// one the roster knows. Expected names come from effort-state.mjs and the spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ROLES, SLOT_NAMES, parseYamlSubset, resolveRoster, resolveWorkflow } from '../plugins/forge-sdlc/hooks/roster.mjs';

const root = new URL('../plugins/forge-sdlc/', import.meta.url);
const text = readFileSync(new URL('workflow.yaml', root), 'utf8');
const { value: file, errors } = parseYamlSubset(text);

/** effort-state.mjs's stage names, the keys of its NEXT table, in its order. */
const effortStages = () => {
  const source = readFileSync(new URL('bin/effort-state.mjs', root), 'utf8');
  const next = /const NEXT = \{([^}]*)\}/.exec(source)?.[1] ?? '';
  return [...next.matchAll(/(\w+):/g)].map((m) => m[1]);
};

test('the shipped workflow.yaml parses in the YAML subset with no errors', () => {
  assert.deepEqual(errors, []);
  assert.equal(file.version, 1);
});

test('its stages are effort-state.mjs’s, in order: map, intent, spec, plan, build, built', () => {
  assert.deepEqual(effortStages(), ['map', 'intent', 'spec', 'plan', 'build', 'built']);
  assert.deepEqual(Object.keys(file.stages), effortStages());
});

test('its gates are intent, spec, plan and pr, numbered 1 to 4, on intent, spec, plan and build', () => {
  const gates = Object.entries(file.stages).filter(([, s]) => s.gate).map(([name, s]) => [name, s.gate.key, s.gate.n]);
  assert.deepEqual(gates, [
    ['intent', 'intent', 1],
    ['spec', 'spec', 2],
    ['plan', 'plan', 3],
    ['build', 'pr', 4],
  ]);
});

test('the shipped file resolves with no problems', () => {
  assert.deepEqual(resolveWorkflow(text, resolveRoster(undefined, undefined)).problems, []);
});

test('every role and slot it names is one the roster knows', () => {
  for (const [name, stage] of Object.entries(file.stages)) {
    for (const role of stage.roles ?? []) assert.ok(ROLES.includes(role), `${name}: role ${role}`);
    for (const slot of stage.slots ?? []) assert.ok(SLOT_NAMES.includes(slot), `${name}: slot ${slot}`);
  }
});

test('flagged is only in Gate 2’s stops, and Gate 4 is the owner’s', () => {
  const gates = resolveWorkflow(text, resolveRoster(undefined, undefined)).stages.filter((s) => s.gate).map((s) => s.gate);
  assert.deepEqual(gates.filter((g) => g.stops.includes('flagged')).map((g) => g.n), [2]);
  assert.deepEqual(gates.map((g) => g.stops), [
    ['open', 'risk-high', 'attended'],
    ['open', 'flagged', 'risk-high', 'attended'],
    ['open', 'risk-high', 'attended'],
    [],
  ]);
  const pr = gates.find((g) => g.key === 'pr');
  assert.equal(pr.mode, 'owner');
  assert.equal(file.stages.build.gate.owner, 'always');
});

test('its closed set of stops is open, flagged, risk-high, attended, in write order', () => {
  assert.deepEqual(file.stops, ['open', 'flagged', 'risk-high', 'attended']);
});
