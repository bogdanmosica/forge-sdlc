#!/usr/bin/env node
// Guardrail: the roster. PreToolUse on Agent and Skill: with `enforce: true` in the host's
// docs/agents/forge.yaml, deny every call the roster does not account for, the lead's and the
// members' alike. Without the file, or with enforce not on, no decision: a host without a roster
// pays nothing.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLUGIN, ROLES } from '../roster.mjs';
import { HOST_CONFIG, ROSTER_FILE, allow, deny, hostDirOf, readRoster, run } from './lib.mjs';

/** The fixed reasons: they name the file and the keys, never the value the call used. */
export const AGENT_REASON =
  'Agent call outside the roster (docs/agents/forge.yaml, enforce: true): fill a role with it or list it under allow.agents, or use a roster agent.';
export const SKILL_REASON =
  'Skill call outside the roster (docs/agents/forge.yaml, enforce: true): fill a slot with it or list it under allow.skills, or use a roster skill.';

/** The host holding the roster: the project dir when it holds forge.md or forge.yaml, else its host through git. */
function hostOf(projectDir) {
  const here = existsSync(path.join(projectDir, HOST_CONFIG)) || existsSync(path.join(projectDir, ROSTER_FILE));
  return here ? projectDir : hostDirOf(projectDir, projectDir);
}

/** A plugin-qualified entry matches that name exactly; a bare entry matches it with or without any plugin prefix. */
export const matches = (name, entry) =>
  entry.includes(':') ? name === entry : name === entry || name.endsWith(`:${entry}`);

const accounted = (name, entries) => entries.some((entry) => matches(name, entry));

/** The Agent types the roster accounts for: each role's default and its resolved agent, and allow.agents. */
const rosterAgents = (roster) => [
  ...ROLES.map((role) => `${PLUGIN}:${role}`),
  ...Object.values(roster.roles).map((r) => r.agent),
  ...roster.allow.agents,
];

/** The named field of a tool input: a non-empty string, `fallback` when absent, else null (malformed). */
function nameIn(input, key, fallback = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input[key] ?? fallback;
  return typeof value === 'string' && value !== '' ? value : null;
}

/** An Agent call's decision: its type, absent read as general-purpose; a malformed input is denied. */
function agentDecision(input, roster) {
  const type = nameIn(input, 'subagent_type', 'general-purpose');
  return type && accounted(type, rosterAgents(roster)) ? allow() : deny(AGENT_REASON);
}

/** The skills the roster accounts for: each slot's resolved skill (none when disabled), the policy entries and allow.skills. */
const rosterSkills = (roster) => [
  ...Object.values(roster.slots).filter((skill) => skill !== 'disabled'),
  ...roster.policy,
  ...roster.allow.skills,
];

/** A Skill call's decision: the loop's own `forge-sdlc:*` skills always pass; a malformed input is denied. */
function skillDecision(input, roster) {
  const skill = nameIn(input, 'skill');
  const passes = skill && (skill.startsWith(`${PLUGIN}:`) || accounted(skill, rosterSkills(roster)));
  return passes ? allow() : deny(SKILL_REASON);
}

export function rosterGuardCheck(payload, { projectDir }) {
  const host = hostOf(projectDir);
  if (!existsSync(path.join(host, ROSTER_FILE))) return allow();
  const roster = readRoster(host);
  if (roster.enforce !== 'on') return allow();
  if (payload.tool_name === 'Agent') return agentDecision(payload.tool_input, roster);
  if (payload.tool_name === 'Skill') return skillDecision(payload.tool_input, roster);
  return allow();
}

// Run only when spawned as the hook; the tests import the check.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(rosterGuardCheck);
}
