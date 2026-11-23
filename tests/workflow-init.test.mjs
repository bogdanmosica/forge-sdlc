// Init writes the workflow knobs to docs/agents/forge.yaml under `workflow:`: the Gates
// question, the Write step's forge.yaml bullet, the forge.md template without `## Gates`, and
// the frame evals' fixture host (evals/lib/host.sh), whose roster now carries `workflow:`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRoster } from '../plugins/forge-sdlc/hooks/roster.mjs';
import { parseForgeConfig } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const skillDir = path.join(root, 'skills', 'init');
const skill = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
const template = readFileSync(path.join(skillDir, 'FORGE-TEMPLATE.md'), 'utf8');

test('init: the forge.md template has no ## Gates and none of its bullets', () => {
  assert.doesNotMatch(template, /^## Gates/m);
  for (const key of ['policy', 'spec', 'max_parallel_slices']) assert.doesNotMatch(template, new RegExp(`^- ${key}:`, 'm'), `no stray ${key} bullet`);
});
