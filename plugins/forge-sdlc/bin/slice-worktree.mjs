#!/usr/bin/env node
// A slice's worktree: `node bin/slice-worktree.mjs <slug>-<nn> [--project <host>] [--add]` prints
// where it lives, outside the repository beside its main checkout,
// `<parent of main checkout>/<main checkout's folder name>-worktrees/<slug>-<nn>` (ADR 0022).
// With --add it also cuts it, on the slice branch from the tip of the effort branch (the host's
// `## Branches` shapes), then runs the host's `## Worktrees` install at the worktree's root; the
// install's output goes to stderr, so stdout stays the one path. An existing worktree is reused,
// not reinstalled. The install is the host's own command, trusted as its proof commands are.
// Exit 0; 1 when git or the install fails; 2 on bad usage, outside a repository, or for a stale
// `dependency_dir` with no `install` (the cut is refused rather than left without dependencies).

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { DEFAULT_BRANCHES, git, hostDirOf, readHostConfig, sliceWorktreeDir, worktreeInstall } from '../hooks/scripts/lib.mjs';

const USAGE = 'usage: slice-worktree.mjs <slug>-<nn> [--project <host>] [--add]\n';
const SLICE = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2,}$/;

function fail(code, message) {
  process.stderr.write(message.endsWith('\n') ? message : `${message}\n`);
  process.exit(code);
}

let values;
let positionals;
try {
  ({ values, positionals } = parseArgs({ allowPositionals: true, options: { project: { type: 'string' }, add: { type: 'boolean' } } }));
} catch (e) {
  fail(2, `${e.message}\n${USAGE}`);
}
const [slice] = positionals;
if (positionals.length !== 1 || !SLICE.test(slice)) fail(2, USAGE);

const host = values.project ? path.resolve(values.project) : hostDirOf(process.cwd(), process.cwd());
const dir = sliceWorktreeDir(host, slice);
if (!dir) fail(2, `${host} is not in a git repository: a slice worktree sits beside the repository's main checkout`);

const config = readHostConfig(host);
const { command, problems } = worktreeInstall(config);
for (const problem of problems) process.stderr.write(`${problem}\n`);

if (!values.add) {
  process.stdout.write(`${dir}\n`);
  process.exit(0);
}
if (problems.length && !command) fail(2, 'no worktree cut: say how a slice worktree gets its dependencies first');
if (existsSync(dir)) {
  process.stdout.write(`${dir}\n`);
  process.exit(0);
}

const shapes = { ...DEFAULT_BRANCHES, ...config?.branches };
const slug = slice.replace(/-\d+$/, '');
const effortBranch = shapes.effort.replace('<slug>', slug);
const sliceBranch = shapes.slice.replace('<slug>-<nn>', slice);
const exists = git(['-C', host, 'show-ref', '--verify', '--quiet', `refs/heads/${sliceBranch}`]).status === 0;
const add = git(['-C', host, 'worktree', 'add', '-q', ...(exists ? [dir, sliceBranch] : ['-b', sliceBranch, dir, effortBranch])]);
if (add.status !== 0) fail(1, `git worktree add ${dir} failed: ${add.stderr.trim()}`);

if (command) {
  const r = spawnSync('/bin/sh', ['-c', command], { cwd: dir, stdio: ['ignore', 2, 2] });
  if (r.status !== 0) fail(1, `install \`${command}\` exited ${r.status ?? r.signal} in ${dir}: the worktree stays; fix the install and rerun it there`);
}
process.stdout.write(`${dir}\n`);
