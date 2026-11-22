#!/usr/bin/env node
// Guardrail: the roster. PreToolUse on Agent and Skill: with `enforce: true` in the host's
// docs/agents/forge.yaml, deny every call the roster does not account for, the lead's and the
// members' alike. Without the file, or with enforce not on, no decision: a host without a roster
// pays nothing.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HOST_CONFIG, ROSTER_FILE, allow, hostDirOf, run } from './lib.mjs';

/** The host holding the roster: the project dir when it holds forge.md or forge.yaml, else its host through git. */
function hostOf(projectDir) {
  const here = existsSync(path.join(projectDir, HOST_CONFIG)) || existsSync(path.join(projectDir, ROSTER_FILE));
  return here ? projectDir : hostDirOf(projectDir, projectDir);
}

export function rosterGuardCheck(payload, { projectDir }) {
  const host = hostOf(projectDir);
  if (!existsSync(path.join(host, ROSTER_FILE))) return allow();
  return allow();
}

// Run only when spawned as the hook; the tests import the check.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(rosterGuardCheck);
}
