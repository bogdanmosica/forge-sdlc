// Slice worktrees live outside the repository, beside the main checkout:
// <parent of main checkout>/<its folder name>-worktrees/<slug>-<nn> (ADR 0022). The host of a path in
// one is resolved through git (the main checkout, then the nearest forge.md, then the host whose
// state holds the worktree's slice branch), never from the worktree's path shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { hostDirOf, hostInCheckout, sliceWorktreeDir, writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { decisionOf, edit, hook, host, reasonOf } from './support/host.mjs';

const gitIn = (dir, args) => {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

const config = ['# forge-sdlc host config', '', '## Branches', '- default: main', '', '## Test file globs', '- globs: tests/**', ''].join('\n');

const state = (effort = {}, slice = {}) => ({
  efforts: {
    x: { stage: 'build', gate: 'none', branch: 'feat/x', mode: 'normal', ...effort, slices: { 'x-01': { status: 'building', mode: 'normal', ...slice } } },
  },
});

/** The worktree beside the repository: `<parent>/<name>-worktrees/<slice>`, cut on `slice/<slice>`. */
function cutOutside(repo, slice = 'x-01') {
  const worktree = path.join(path.dirname(repo), `${path.basename(repo)}-worktrees`, slice);
  gitIn(repo, ['worktree', 'add', '-q', '-b', `slice/${slice}`, worktree]);
  return worktree;
}

/** A monorepo whose host is projects/a, on feat/x, with slice x-01 cut outside; `{ repo, dir, worktree }`. */
function subfolderHost({ effort, slice, withState = true } = {}) {
  const { dir: repo } = host({ config: null });
  const dir = path.join(repo, 'projects', 'a');
  mkdirSync(path.join(dir, 'docs', 'agents'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'agents', 'forge.md'), config);
  mkdirSync(path.join(dir, 'docs', 'efforts', 'x'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'efforts', 'x', 'spec.md'), '# Spec\n');
  mkdirSync(path.join(repo, 'projects', 'b'), { recursive: true });
  writeFileSync(path.join(repo, 'projects', 'b', 'README.md'), '# b\n');
  gitIn(repo, ['add', '-A']);
  gitIn(repo, ['commit', '-q', '-m', 'host in projects/a']);
  gitIn(repo, ['switch', '-q', '-c', 'feat/x']);
  const worktree = cutOutside(repo);
  if (withState) writeState(dir, state(effort, slice));
  return { repo, dir, worktree };
}

test('sliceWorktreeDir: beside the main checkout, from the main checkout, a subfolder host and a worktree alike', () => {
  const { repo, dir, worktree } = subfolderHost();
  const want = path.join(path.dirname(realpathSync(repo)), `${path.basename(repo)}-worktrees`, 'x-02');
  assert.equal(sliceWorktreeDir(repo, 'x-02'), want);
  assert.equal(sliceWorktreeDir(dir, 'x-02'), want);
  assert.equal(sliceWorktreeDir(path.join(worktree, 'projects', 'a'), 'x-02'), want);
  assert.equal(realpathSync(worktree), sliceWorktreeDir(dir, 'x-01'));
});

test('hostDirOf: a subfolder host from an outside worktree, with the cwd at the worktree root and deep inside', () => {
  const { dir, worktree } = subfolderHost();
  const real = realpathSync(dir);
  assert.equal(hostDirOf(worktree, 'unused'), real, 'worktree root');
  assert.equal(hostDirOf(path.join(worktree, 'projects', 'a', 'src', 'not-yet'), 'unused'), real, 'deep in the host');
  assert.equal(hostDirOf(path.join(worktree, 'projects', 'b'), 'unused'), real, 'in another project folder');
});

test('hostDirOf: an outside worktree whose branch no host state holds resolves to the main checkout, as before', () => {
  const { repo, worktree } = subfolderHost({ withState: false });
  assert.equal(hostDirOf(worktree, 'unused'), realpathSync(repo));
});

test('hostDirOf: a single-repo host from an outside worktree, root and deep', () => {
  const { dir } = host({ branch: 'feat/x' });
  const worktree = cutOutside(dir);
  writeState(dir, state());
  assert.equal(hostDirOf(worktree, 'unused'), realpathSync(dir));
  assert.equal(hostDirOf(path.join(worktree, 'src', 'deep'), 'unused'), realpathSync(dir));
});

test('hostInCheckout: the host as checked out in an outside worktree', () => {
  const { dir, worktree } = subfolderHost();
  assert.equal(hostInCheckout(dir, worktree), path.join(realpathSync(worktree), 'projects', 'a'));
});

test('spec-frozen and test-frozen hold in an outside worktree of a subfolder host', () => {
  const { dir, worktree } = subfolderHost({ slice: { mode: 'fix' } });
  const spec = hook('spec-frozen.mjs', edit(worktree, 'projects/a/docs/efforts/x/spec.md'), { projectDir: worktree });
  assert.equal(spec.status, 0, spec.stderr);
  assert.equal(decisionOf(spec), 'deny');
  const tests = hook('test-frozen.mjs', edit(worktree, 'projects/a/tests/a.test.ts'), { projectDir: worktree });
  assert.equal(decisionOf(tests), 'deny');
  assert.match(reasonOf(tests), /tests\/a\.test\.ts matches the test glob tests\/\*\*/);
  assert.equal(decisionOf(hook('test-frozen.mjs', edit(worktree, 'projects/a/src/app.ts'), { projectDir: dir })), 'allow');
});

test('verified-before-stop: a stop with the cwd at the outside worktree root names the host projects/a', () => {
  const { dir, worktree } = subfolderHost();
  const r = hook('verified-before-stop.mjs', { hook_event_name: 'Stop', cwd: worktree, stop_hook_active: false }, { projectDir: worktree });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, 'block');
  assert.ok(r.decision.reason.includes(`--project "${realpathSync(dir)}"`), r.decision.reason);
});

test('verified-before-stop: a SubagentStop by agent id finds the slice in its outside worktree', () => {
  const { dir, worktree } = subfolderHost({ slice: { agent: 'agent-7' } });
  const r = hook('verified-before-stop.mjs', { hook_event_name: 'SubagentStop', agent_id: 'agent-7', cwd: dir, stop_hook_active: false }, { projectDir: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, 'block');
  assert.ok(r.decision.reason.includes(`--worktree "${realpathSync(worktree)}"`), r.decision.reason);
});
