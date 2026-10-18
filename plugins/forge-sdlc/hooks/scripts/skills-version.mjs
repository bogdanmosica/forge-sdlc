#!/usr/bin/env node
// Tripwire: upstream version. SessionStart (startup, resume, clear; a compaction is the same
// session and stays quiet): compare the installed mattpocock-skills plugin with UPSTREAM.lock
// and warn the driver once, in the session's first turn, when it is missing, another version,
// or no longer carries a heading the loop reads. An `ok` verdict writes nothing.

import { checkUpstream, warningFor } from '../../bin/upstream.mjs';
import { run } from './lib.mjs';

const QUIET_SOURCES = new Set(['compact']);

export function skillsVersionCheck(payload, { projectDir, env }) {
  if (QUIET_SOURCES.has(payload.source)) return {};
  const warning = warningFor(checkUpstream({ env, projectDir }));
  if (!warning) return {};
  return {
    systemMessage: warning,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: warning },
  };
}

process.exitCode = await run(skillsVersionCheck);
