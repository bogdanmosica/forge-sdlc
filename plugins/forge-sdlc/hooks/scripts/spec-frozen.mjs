#!/usr/bin/env node
// Guardrail: frozen artifacts. PreToolUse on Edit and Write: deny an edit to
// docs/efforts/<slug>/intent.md, spec.md or plan.md once .forge/state.json puts that effort in
// stage `build` or `built`. The path's tail decides, so the same file inside a slice worktree of
// the host is frozen too. The state is the host's, found through git from the edited file's
// checkout, so a session whose project dir is the worktree is held too. map.md stays live; a host
// with no state has nothing frozen.

import path from 'node:path';

import { allow, deny, effortOf, hostDirOf, readState, run } from './lib.mjs';

const FROZEN_FILE = /(^|\/)docs\/efforts\/([^/]+)\/(intent|spec|plan)\.md$/;
const FROZEN_STAGES = new Set(['build', 'built']);

export function specFrozenCheck(payload, { projectDir }) {
  if (payload.tool_name !== 'Edit' && payload.tool_name !== 'Write') return allow();
  const filePath = payload.tool_input?.file_path ?? '';
  const m = FROZEN_FILE.exec(filePath);
  if (!m) return allow();
  const [, , slug, name] = m;
  const effort = effortOf(readState(hostDirOf(path.dirname(filePath), projectDir)), slug);
  if (!effort || !FROZEN_STAGES.has(effort.stage)) return allow();
  return deny(
    `docs/efforts/${slug}/${name}.md is frozen: effort ${slug} is in stage ${effort.stage} (.forge/state.json), ` +
      'so its intent, spec and plan are the source of truth for the code. Fix the code to match the artifact, ' +
      `or reopen the gate: set the effort's stage back to plan in .forge/state.json, then rerun /forge-sdlc:${name === 'intent' ? 'wayfinder' : name} ${slug}.`,
  );
}

process.exitCode = await run(specFrozenCheck);
