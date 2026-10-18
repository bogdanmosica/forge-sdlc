#!/usr/bin/env node
// Guardrail: frozen tests in fix mode. PreToolUse on Edit and Write: deny an edit to a file
// matching the host's test globs (docs/agents/forge.md, Test file globs) while the checkout it
// lands in is in fix mode (.forge/state.json). The edited file's checkout decides whose mode
// counts: a slice worktree (branch slice/<slug>-<nn>) reads that slice's mode, the main checkout
// on feat/<slug> reads the effort's. The state is the host's, found through git from that checkout,
// so a session whose project dir is the worktree is held too. Quiet without state, globs, or a
// branch of either shape.

import path from 'node:path';

import { DEFAULT_BRANCHES, allow, branchRules, checkoutRootOf, currentBranch, deny, effortOf, hostDirOf, listOf, matchesGlob, matchesPath, readState, run } from './lib.mjs';

/** The name a branch shape's placeholder stands for: `slice/x-01` under `slice/<slug>-<nn>` is `x-01`. */
const nameIn = (branch, shape) => branch.slice(shape.indexOf('<'));

/** `{ where, mode }` for the checkout on `branch`, or null when the branch is neither a slice nor an effort branch. */
function modeOf(state, branch, config, dir) {
  const rules = branchRules(config, dir);
  const shapes = { ...DEFAULT_BRANCHES, ...config?.branches };
  if (matchesGlob(branch, rules.slice)) {
    const slice = nameIn(branch, shapes.slice);
    const record = effortOf(state, slice.replace(/-\d+$/, ''))?.slices?.[slice];
    return { where: `slice ${slice}`, mode: record?.mode };
  }
  if (matchesGlob(branch, rules.effort)) {
    const slug = nameIn(branch, shapes.effort);
    return { where: `effort ${slug}`, mode: effortOf(state, slug)?.mode };
  }
  return null;
}

export function testFrozenCheck(payload, { projectDir, config }) {
  if (payload.tool_name !== 'Edit' && payload.tool_name !== 'Write') return allow();
  const filePath = payload.tool_input?.file_path;
  if (!filePath) return allow();
  const globs = listOf(config?.['test-file-globs']?.globs);
  if (globs.length === 0) return allow();
  const root = checkoutRootOf(path.dirname(filePath));
  if (!root) return allow();
  const rel = path.relative(root, path.resolve(filePath)).split(path.sep).join('/');
  const glob = globs.find((g) => matchesPath(rel, g));
  if (!glob) return allow();
  const state = readState(hostDirOf(root, projectDir));
  const branch = currentBranch(root);
  if (!state || !branch) return allow();
  const found = modeOf(state, branch, config, root);
  if (found?.mode !== 'fix') return allow();
  return deny(
    `${rel} matches the test glob ${glob} (docs/agents/forge.md, Test file globs) and ${found.where} is in fix mode ` +
      '(.forge/state.json): the failing test is the spec. Fix the code until the test passes, without editing the test. ' +
      'If the test itself is wrong, stop and say so; the human leaves fix mode and edits it.',
  );
}

process.exitCode = await run(testFrozenCheck);
