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

const AGENT_REASON =
  'Agent call outside the roster (docs/agents/forge.yaml, enforce: true): fill a role with it or list it under allow.agents, or use a roster agent.';
const SKILL_REASON =
  'Skill call outside the roster (docs/agents/forge.yaml, enforce: true): fill a slot with it or list it under allow.skills, or use a roster skill.';

const enforced = (...lines) => ['version: 1', 'enforce: true', ...lines, ''].join('\n');

test('with enforce false, absent or another value no call gets a decision', () => {
  for (const yaml of ['version: 1\nenforce: false\n', 'version: 1\n', 'version: 1\nenforce: yes-please\n']) {
    const dir = rosterHost(yaml);
    assert.deepEqual(check(agentCall(dir, 'Explore')), {}, yaml);
    assert.deepEqual(check(skillCall(dir, 'some-plugin:unrelated')), {}, yaml);
  }
});

test('under enforcement a built-in agent not allowed is denied with the fixed Agent reason', () => {
  const d = check(agentCall(rosterHost(enforced()), 'Explore'));
  assert.equal(decisionOf(d), 'deny');
  assert.equal(d.hookSpecificOutput.permissionDecisionReason, AGENT_REASON);
});

test('under enforcement an unrelated skill is denied with the fixed Skill reason', () => {
  const d = check(skillCall(rosterHost(enforced()), 'some-plugin:unrelated'));
  assert.equal(decisionOf(d), 'deny');
  assert.equal(d.hookSpecificOutput.permissionDecisionReason, SKILL_REASON);
});

const passes = (d) => assert.equal(decisionOf(d), 'none', JSON.stringify(d));
const denied = (d) => assert.equal(decisionOf(d), 'deny', JSON.stringify(d));

test('under enforcement an Agent call passes for a role default, a roster agent or allow.agents', () => {
  const dir = rosterHost(enforced('roles:', '  reviewer:', '    agent: my-plugin:reviewer', 'allow:', '  agents: [Explore]'));
  for (const role of ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger'])
    passes(check(agentCall(dir, `forge-sdlc:${role}`)));
  passes(check(agentCall(dir, 'my-plugin:reviewer')));
  passes(check(agentCall(dir, 'Explore')));
  denied(check(agentCall(dir, 'Plan')));
});

test('under enforcement an Agent call with no type reads as general-purpose', () => {
  denied(check(agentCall(rosterHost(enforced()), undefined)));
  passes(check(agentCall(rosterHost(enforced('allow:', '  agents: [general-purpose]')), undefined)));
});
