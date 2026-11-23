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

test('workflow is a roster key: an empty workflow: section is no problem and changes nothing', () => {
  const r = resolveRoster(yaml('workflow:'), undefined);
  assert.deepEqual(r.workflow, DEFAULT_WORKFLOW);
  assert.deepEqual(r.problems, []);
});
