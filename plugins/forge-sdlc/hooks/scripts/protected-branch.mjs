#!/usr/bin/env node
// Guardrail: protected branch. PreToolUse on Edit, Write, NotebookEdit and Bash `git commit`:
// deny when the branch the call lands on is protected. Protected is the default branch
// (from docs/agents/forge.md, else detected) plus the config's `protected` globs, so the
// rule holds on a host that has not run init yet, as long as its default branch can be told.

import { allow, branchRules, currentBranch, cwdOf, deny, gitSegmentsOf, matchesGlob, run, targetDirOf } from './lib.mjs';

/** The deny for a call landing in the checkout at `dir`, or null when its branch is not protected. */
function protectedDeny(dir, config, what) {
  const branch = currentBranch(dir);
  if (!branch) return null;
  const rules = branchRules(config, dir);
  const hit = rules.protected.find((pattern) => matchesGlob(branch, pattern));
  if (!hit) return null;
  const source = rules.configured ? 'docs/agents/forge.md, Branches' : 'the default branch';
  return deny(
    `Branch ${branch} is protected (${hit}: ${source}). ${what} on it are refused. ` +
      `Work on the effort branch: git switch -c ${rules.effort.replace('*', '<slug>')}, then retry.`,
  );
}

export function protectedBranchCheck(payload, { config }) {
  if (payload.tool_name !== 'Bash') return protectedDeny(targetDirOf(payload), config, 'Edits') ?? allow();
  // Each `git commit` the command runs, in the checkout a `cd` or its own `-C` leads to.
  for (const seg of gitSegmentsOf(payload.tool_input?.command, cwdOf(payload))) {
    const denied = seg.sub === 'commit' && protectedDeny(seg.dir, config, 'Commits');
    if (denied) return denied;
  }
  return allow();
}

process.exitCode = await run(protectedBranchCheck);
