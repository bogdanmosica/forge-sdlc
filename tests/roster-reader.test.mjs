// The shared roster reader (plugins/forge-sdlc/hooks/roster.mjs): the strict
// YAML subset of docs/agents/forge.yaml and the resolved roster every consumer
// reads (lib.mjs, bin/roster.mjs, roster-guard.mjs, the run pane mod, the help
// panel). Fixture texts inline; expected values come from the spec's schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseYamlSubset, resolveRoster } from '../plugins/forge-sdlc/hooks/roster.mjs';

const yaml = (...lines) => lines.join('\n');

const ROLES = ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger'];
const DEFAULT_ROLES = Object.fromEntries(ROLES.map((r) => [r, { agent: `forge-sdlc:${r}`, swapped: false }]));
const DEFAULT_SLOTS = {
  'implementer.tdd': 'mattpocock-skills:tdd',
  'prototyper.prototype': 'mattpocock-skills:prototype',
  grilling: 'mattpocock-skills:grilling',
  'spec-writer.codebase-design': 'mattpocock-skills:codebase-design',
  'domain-modeling': 'mattpocock-skills:domain-modeling',
};

test('without forge.yaml or forge.md the roster is exactly today’s defaults', () => {
  assert.deepEqual(resolveRoster(undefined, undefined), {
    present: false,
    version: null,
    enforce: 'off',
    roles: DEFAULT_ROLES,
    slots: DEFAULT_SLOTS,
    policy: [],
    allow: { agents: [], skills: [] },
    problems: [],
  });
});
