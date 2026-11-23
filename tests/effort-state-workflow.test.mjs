// bin/effort-state.mjs over the resolved workflow (docs/efforts/workflow-as-code/spec.md, `effort-state.mjs`):
// the `gates` field with each gate's mode and source, the `attended` stop and its why, and a host with
// forge.md `## Gates` and no forge.yaml printing what it printed before apart from `gates`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { forgeMd, host } from './support/host.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'bin', 'effort-state.mjs');

/** forge.md with Branches only: no ## Gates. */
const BRANCHES_ONLY = ['# forge-sdlc host config', '', '## Branches', '- default: main', ''].join('\n');

/** A host with this forge.md (default: Branches only), this forge.yaml text when given, and these state efforts. */
function stateHost({ config = BRANCHES_ONLY, yaml, efforts = {} } = {}) {
  const { dir } = host({ config });
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  writeState(dir, { efforts });
  return dir;
}

/** The JSON effort-state.mjs prints for `args`, exit 0. */
function run(...args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const effort = (stage, gate, extra = {}) => ({ stage, gate, mode: 'normal', risk: 'normal', branch: 'feat/x', pr: null, slices: {}, updatedAt: '2026-10-17T10:00:00Z', ...extra });

test('gates: each gate\'s mode and source, from forge.yaml over the default, Gate 4 the owner\'s', () => {
  const dir = stateHost({ yaml: 'workflow:\n  policy: autonomous\n  gates:\n    plan: attended\n', efforts: { x: effort('spec', 'spec') } });
  assert.deepEqual(run(dir, 'x').gates, {
    intent: { mode: 'policy', source: 'workflow.policy in forge.yaml' },
    spec: { mode: 'policy', source: 'workflow.policy in forge.yaml' },
    plan: { mode: 'attended', source: 'gates.plan in forge.yaml' },
    pr: { mode: 'owner', source: 'always' },
  });
});
