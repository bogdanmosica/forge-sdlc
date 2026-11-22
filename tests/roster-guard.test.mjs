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

import { forgeMd, hook } from './support/host.mjs';
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

test('under enforcement a Skill call passes for a slot skill, a policy entry, a forge-sdlc skill or allow.skills', () => {
  const dir = rosterHost(
    enforced(
      'slots:',
      '  implementer.tdd: other-plugin:tdd',
      '  domain-modeling: disabled',
      '  policy: [house-style:writing-rules]',
      'allow:',
      '  skills: [util:format]',
    ),
  );
  passes(check(skillCall(dir, 'other-plugin:tdd')));
  passes(check(skillCall(dir, 'mattpocock-skills:grilling')));
  passes(check(skillCall(dir, 'house-style:writing-rules')));
  passes(check(skillCall(dir, 'forge-sdlc:spec')));
  passes(check(skillCall(dir, 'util:format')));
  denied(check(skillCall(dir, 'mattpocock-skills:tdd')), 'a swapped-out slot default');
  denied(check(skillCall(dir, 'mattpocock-skills:domain-modeling')), 'a disabled slot');
  denied(check(skillCall(dir, 'disabled')), 'the disabled marker is no skill');
});

test('a qualified entry matches exactly, a bare entry with or without any plugin prefix', () => {
  const dir = rosterHost(enforced('allow:', '  agents: [scout, tools:mapper]', '  skills: [fmt, util:lint]'));
  passes(check(agentCall(dir, 'scout')));
  passes(check(agentCall(dir, 'any-plugin:scout')));
  passes(check(agentCall(dir, 'tools:mapper')));
  denied(check(agentCall(dir, 'mapper')));
  denied(check(agentCall(dir, 'other:mapper')));
  denied(check(agentCall(dir, 'scouts')));
  passes(check(skillCall(dir, 'fmt')));
  passes(check(skillCall(dir, 'house:fmt')));
  passes(check(skillCall(dir, 'util:lint')));
  denied(check(skillCall(dir, 'lint')));
  denied(check(skillCall(dir, 'other:lint')));
});

test('the lead and a member are held alike: agent_id is not consulted', () => {
  const dir = rosterHost(enforced());
  const member = { agent_id: 'a1b2c3', agent_type: 'forge-sdlc:implementer' };
  denied(check(agentCall(dir, 'Explore')));
  denied(check(agentCall(dir, 'Explore', member)));
  denied(check(skillCall(dir, 'some-plugin:unrelated', member)));
  passes(check(skillCall(dir, 'mattpocock-skills:tdd', member)));
});

test('enforcement holds when enforce: true parses beside bad entries (fail closed)', () => {
  const dir = rosterHost(
    ['version: 7', 'enforce: true', 'roles:', '  bogus:', '    agent: Explore', 'slots:', '  nope: x', 'allow:', '  weird: [Explore]', 'later: 1', ''].join('\n'),
  );
  denied(check(agentCall(dir, 'Explore')));
  denied(check(skillCall(dir, 'x')));
  passes(check(agentCall(dir, 'forge-sdlc:reviewer')));
});

test('a file too broken to read enforce gets no decision (fail open)', () => {
  for (const yaml of ['version: 1\nenforce: &on true\n', 'version: 1\n\tenforce: true\n', 'just words\n']) {
    const dir = rosterHost(yaml);
    assert.deepEqual(check(agentCall(dir, 'Explore')), {}, yaml);
    assert.deepEqual(check(skillCall(dir, 'some-plugin:unrelated')), {}, yaml);
  }
});

test('a malformed Agent or Skill payload under enforcement gets a deny, never a throw', () => {
  const dir = rosterHost(enforced('allow:', '  agents: [general-purpose]', '  skills: [fmt]'));
  const call = (tool_name, tool_input) => ({ hook_event_name: 'PreToolUse', tool_name, tool_input, cwd: dir });
  for (const input of [undefined, null, 'Explore', 42, [], { subagent_type: 7 }, { subagent_type: {} }, { subagent_type: '' }])
    denied(check(call('Agent', input)));
  for (const input of [undefined, null, 'fmt', 42, [], {}, { skill: 7 }, { skill: ['fmt'] }, { skill: '' }])
    denied(check(call('Skill', input)));
});

test('spawned as the hook, it exits 0 with one JSON decision for any stdin', () => {
  const dir = rosterHost(enforced());
  const deny = hook('roster-guard.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: null, cwd: dir });
  assert.equal(deny.status, 0, deny.stderr);
  assert.equal(deny.decision.hookSpecificOutput?.permissionDecision, 'deny');
  const none = hook('roster-guard.mjs', agentCall(rosterHost(), 'Explore'));
  assert.equal(none.status, 0, none.stderr);
  assert.deepEqual(none.decision, {});
});

test('a deny reason never contains the value the call used', () => {
  const dir = rosterHost(enforced('allow:', '  agents: [scout]', '  skills: [fmt]'));
  for (const type of ['Explore', 'secret-plugin:spy-agent']) {
    const reason = check(agentCall(dir, type)).hookSpecificOutput.permissionDecisionReason;
    assert.equal(reason, AGENT_REASON);
    assert.ok(!reason.includes(type), type);
  }
  for (const skill of ['secret-plugin:exfiltrate', 'tdd-but-other']) {
    const reason = check(skillCall(dir, skill)).hookSpecificOutput.permissionDecisionReason;
    assert.equal(reason, SKILL_REASON);
    assert.ok(!reason.includes(skill), skill);
  }
});
