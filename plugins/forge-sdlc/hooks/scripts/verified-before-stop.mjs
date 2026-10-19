#!/usr/bin/env node
// Gate: verified before stop. Stop and SubagentStop in a slice worktree (branch matching the
// slice glob): block unless .forge/verify/<slice>.json in the host is green at the worktree's
// current HEAD; the reason is the verify-record command to run. Denials are counted per slice
// beside the record and are the loop guard: stop_hook_active is ignored, so the gate keeps
// blocking until the record is fresh and green or three stops were refused; the next stop then
// passes once with the red reason, the slice is marked red in state (its `agent` cleared) and
// the count resets. A subagent's SubagentStop carries the lead's root as cwd, never the worktree
// it cd-ed into: when the cwd names no slice, the slice is the one whose `agent` in the host's
// state is the payload's agent_id, gated the same way while its worktree exists.
// Quiet outside a slice worktree, outside a repo, and for an agent id no slice carries.

import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_BRANCHES, allow, block, branchRules, currentBranch, cwdOf, effortOf, git, hostDirOf, matchesGlob, readState, run, writeState } from './lib.mjs';

const MAX_DENIALS = 3;
const VERIFY_RECORD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'verify-record.mjs');

const gitOut = (dir, args) => git(['-C', dir, ...args]).stdout.trim();

const sliceShape = (config) => config?.branches?.slice || DEFAULT_BRANCHES.slice;

/** `slice/<slug>-<nn>` is `<slug>-<nn>`: the branch minus the slice shape's literal prefix. */
function sliceOf(branch, config) {
  const shape = sliceShape(config);
  return branch.slice(shape.indexOf('<'));
}

/** Why the record does not let the stop through, or null when it is green at `head`. */
function staleness(file, head) {
  if (!existsSync(file)) return 'no record';
  let record;
  try {
    record = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return 'unreadable record';
  }
  if (record.head !== head) return 'stale record: a commit came after the run';
  return record.green === true ? null : 'red record: a command exited non-zero';
}

/** `status: red` on the slice, and its `agent` cleared: a stale id never gates a later stop. */
function markRed(projectDir, slice) {
  const state = readState(projectDir);
  const effort = effortOf(state, slice.replace(/-\d+$/, ''));
  if (!effort) return;
  effort.slices ??= {};
  const { agent, ...rest } = effort.slices[slice] ?? {};
  effort.slices[slice] = { ...rest, status: 'red' };
  effort.updatedAt = new Date().toISOString();
  writeState(projectDir, state);
}

/** The slice the cwd is a checkout of: `{ slice, branch, worktree, project, head }`, or null. */
function sliceAtCwd(cwd, config) {
  const branch = currentBranch(cwd);
  if (!branch || !matchesGlob(branch, branchRules(config, cwd).slice)) return null;
  return {
    slice: sliceOf(branch, config),
    branch,
    worktree: gitOut(cwd, ['rev-parse', '--show-toplevel']),
    project: path.dirname(gitOut(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'])),
    head: gitOut(cwd, ['rev-parse', 'HEAD']),
  };
}

/** The slice whose `agent` is a SubagentStop's agent_id, while its worktree exists; else null. */
function sliceOfAgent(payload, cwd, projectDir, config) {
  if (payload.hook_event_name !== 'SubagentStop' || !payload.agent_id) return null;
  const project = hostDirOf(cwd, projectDir);
  for (const effort of Object.values(readState(project)?.efforts ?? {})) {
    for (const [slice, record] of Object.entries(effort?.slices ?? {})) {
      if (record?.agent !== payload.agent_id) continue;
      const worktree = path.join(project, '.forge', 'worktrees', slice);
      if (!existsSync(worktree)) return null;
      return { slice, branch: sliceShape(config).replace('<slug>-<nn>', slice), worktree, project, head: gitOut(worktree, ['rev-parse', 'HEAD']) };
    }
  }
  return null;
}

export function verifiedBeforeStopCheck(payload, { projectDir, config }) {
  const cwd = cwdOf(payload);
  const found = sliceAtCwd(cwd, config) ?? sliceOfAgent(payload, cwd, projectDir, config);
  if (!found) return allow();

  const { slice, branch, worktree, project, head } = found;
  const dir = path.join(project, '.forge', 'verify');
  const denials = path.join(dir, `${slice}.denials`);

  const why = staleness(path.join(dir, `${slice}.json`), head);
  if (!why) {
    if (existsSync(denials)) unlinkSync(denials);
    return allow();
  }

  const count = existsSync(denials) ? Number(readFileSync(denials, 'utf8')) || 0 : 0;
  if (count >= MAX_DENIALS) {
    markRed(project, slice);
    unlinkSync(denials);
    return {
      systemMessage:
        `Slice ${slice} stops red: ${MAX_DENIALS} stops were refused without a green verify record (${why}). ` +
        'It is marked red; its branch and worktree stay, and it is listed under Red slices, never merged.',
    };
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(denials, `${count + 1}\n`);
  return block(
    `Slice ${slice} (branch ${branch}) has no green verify record at HEAD ${head.slice(0, 12)}: ${why}. ` +
      `Commit your work, then run: node "${VERIFY_RECORD}" --slice ${slice} --worktree "${worktree}" --project "${project}" ` +
      `--proof "<the ticket's proof command>". Fix what it reports, commit, and rerun until it exits 0, then stop. ` +
      `Denial ${count + 1} of ${MAX_DENIALS}: after that the stop passes and the slice is marked red.`,
  );
}

process.exitCode = await run(verifiedBeforeStopCheck);
