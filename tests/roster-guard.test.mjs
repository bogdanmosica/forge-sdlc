// The roster guard (plugins/forge-sdlc/hooks/scripts/roster-guard.mjs): PreToolUse on Agent and
// Skill, under `enforce: true` in docs/agents/forge.yaml every call the roster does not account
// for is denied, for the lead and members alike; without the file or with enforce not on, no
// decision (docs/efforts/roster-as-code/spec.md, `roster-guard.mjs`). The check is imported and
// run against fixture host dirs; the script is spawned as Claude Code spawns it for the
// process-boundary cases.
//
//   node --test tests/roster-guard.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { forgeMd } from './support/host.mjs';
import { rosterGuardCheck } from '../plugins/forge-sdlc/hooks/scripts/roster-guard.mjs';

/** A host dir with forge.md and, when given, this forge.yaml text. No git: the files sit at the project dir. */
function rosterHost(yaml) {
  const dir = mkdtempSync(path.join(tmpdir(), 'forge-guard-'));
  mkdirSync(path.join(dir, 'docs', 'agents'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'agents', 'forge.md'), forgeMd());
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  return dir;
}

const agentCall = (dir, type, extra = {}) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Agent',
  tool_input: { description: 'look around', prompt: 'go', ...(type === undefined ? {} : { subagent_type: type }) },
  cwd: dir,
  ...extra,
});

const skillCall = (dir, skill, extra = {}) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Skill',
  tool_input: { skill },
  cwd: dir,
  ...extra,
});

const check = (payload) => rosterGuardCheck(payload, { projectDir: payload.cwd });
const decisionOf = (d) => d.hookSpecificOutput?.permissionDecision ?? 'none';

test('without forge.yaml no call gets a decision', () => {
  const dir = rosterHost();
  assert.deepEqual(check(agentCall(dir, 'Explore')), {});
  assert.deepEqual(check(skillCall(dir, 'some-plugin:unrelated')), {});
});
