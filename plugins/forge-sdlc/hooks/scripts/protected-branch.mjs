#!/usr/bin/env node
// Guardrail: protected branch. PreToolUse on Edit, Write, NotebookEdit and Bash `git commit`:
// deny when the branch the call lands on is protected. Protected is the default branch
// (from docs/agents/forge.md, else detected) plus the config's `protected` globs, so the
// rule holds on a host that has not run init yet, as long as its default branch can be told.

import { allow, branchRules, currentBranch, deny, isGitCommit, matchesGlob, run, targetDirOf } from './lib.mjs';

export function protectedBranchCheck(payload, { config }) {
  if (payload.tool_name === 'Bash' && !isGitCommit(payload.tool_input?.command)) return allow();
  const dir = targetDirOf(payload);
  const branch = currentBranch(dir);
  if (!branch) return allow();
  const rules = branchRules(config, dir);
  const hit = rules.protected.find((pattern) => matchesGlob(branch, pattern));
  if (!hit) return allow();
  const what = payload.tool_name === 'Bash' ? 'Commits' : 'Edits';
  const source = rules.configured ? 'docs/agents/forge.md, Branches' : 'the default branch';
  return deny(
    `Branch ${branch} is protected (${hit}: ${source}). ${what} on it are refused. ` +
      `Work on the effort branch: git switch -c ${rules.effort.replace('*', '<slug>')}, then retry.`,
  );
}

process.exitCode = await run(protectedBranchCheck);
