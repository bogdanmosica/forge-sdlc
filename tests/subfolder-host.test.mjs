// A host that is a subfolder of its repository, as in a monorepo: docs/agents/forge.md and
// .forge/ live in projects/a, the session is launched there, and slice worktrees are whole-repo
// checkouts. The hooks must read the state, the verify records and the test globs from projects/a,
// not from the repository root. The worktrees here are the pre-0.7.0 shape, under
// projects/a/.forge/worktrees/, which still resolves; tests/outside-worktree.test.mjs holds the
// current one, beside the repository (ADR 0022).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { hostDirOf, writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { decisionOf, edit, hook, host, reasonOf } from './support/host.mjs';

const gitIn = (dir, args) => {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

const config = [
  '# forge-sdlc host config',
  '',
  '## Branches',
  '- default: main',
  '',
  '## Test file globs',
  '- globs: tests/**',
  '',
].join('\n');

/**
 * A repository without a root forge.md whose host is projects/a, on branch feat/x, with a slice
 * worktree x-01 cut under the host's .forge/worktrees; `{ repo, dir, worktree }` (dir is the host).
 */
function subfolderHost({ effort = {}, slice = {} } = {}) {
  const { dir: repo } = host({ config: null });
  const dir = path.join(repo, 'projects', 'a');
  mkdirSync(path.join(dir, 'docs', 'agents'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'agents', 'forge.md'), config);
  mkdirSync(path.join(dir, 'docs', 'efforts', 'x'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'efforts', 'x', 'spec.md'), '# Spec\n');
  gitIn(repo, ['add', '-A']);
  gitIn(repo, ['commit', '-q', '-m', 'host in projects/a']);
  gitIn(repo, ['switch', '-q', '-c', 'feat/x']);
  const worktree = path.join(dir, '.forge', 'worktrees', 'x-01');
  gitIn(repo, ['worktree', 'add', '-q', '-b', 'slice/x-01', worktree]);
  writeState(dir, {
    efforts: {
      x: { stage: 'build', gate: 'none', branch: 'feat/x', mode: 'normal', ...effort, slices: { 'x-01': { status: 'building', mode: 'normal', ...slice } } },
    },
  });
  return { repo, dir, worktree };
}

test('hostDirOf: the host of a path in the main checkout is the nearest folder with docs/agents/forge.md', () => {
  const { repo, dir } = subfolderHost();
  const real = realpathSync(dir);
  assert.equal(hostDirOf(path.join(dir, 'docs', 'efforts', 'x'), 'unused'), real);
  assert.equal(hostDirOf(path.join(dir, 'src', 'not-yet', 'there'), 'unused'), real);
  // Outside any host folder, the checkout root, as before.
  assert.equal(hostDirOf(repo, 'unused'), realpathSync(repo));
});

test('hostDirOf: a path in a pre-0.7.0 slice worktree resolves to the folder holding .forge/worktrees, wherever in the worktree it is', () => {
  const { dir, worktree } = subfolderHost();
  const real = realpathSync(dir);
  assert.equal(hostDirOf(worktree, 'unused'), real);
  assert.equal(hostDirOf(path.join(worktree, 'projects', 'a', 'docs'), 'unused'), real);
});

test('hostDirOf: a single-repo host resolves as before, for the checkout and its pre-0.7.0 slice worktrees', () => {
  const { dir } = host({ branch: 'feat/x' });
  const worktree = path.join(dir, '.forge', 'worktrees', 'x-01');
  gitIn(dir, ['worktree', 'add', '-q', '-b', 'slice/x-01', worktree]);
  assert.equal(hostDirOf(path.join(dir, 'src'), 'unused'), realpathSync(dir));
  assert.equal(hostDirOf(path.join(worktree, 'docs'), 'unused'), realpathSync(dir));
});

test('spec-frozen: the host state in projects/a/.forge freezes spec.md, in the main checkout and in a slice worktree', () => {
  const { dir, worktree } = subfolderHost();
  const inMain = hook('spec-frozen.mjs', edit(dir, 'docs/efforts/x/spec.md'), { projectDir: dir });
  assert.equal(inMain.status, 0, inMain.stderr);
  assert.equal(decisionOf(inMain), 'deny');
  const inSlice = hook('spec-frozen.mjs', edit(worktree, 'projects/a/docs/efforts/x/spec.md'), { projectDir: dir });
  assert.equal(decisionOf(inSlice), 'deny');
  assert.match(reasonOf(inSlice), /docs\/efforts\/x\/spec\.md is frozen/);
});

test('test-frozen: a host-relative glob (tests/**) holds for projects/a/tests in the main checkout and in a slice worktree', () => {
  const { dir, worktree } = subfolderHost({ effort: { mode: 'fix' }, slice: { mode: 'fix' } });
  const inMain = hook('test-frozen.mjs', edit(dir, 'tests/support/fixture.ts'), { projectDir: dir });
  assert.equal(inMain.status, 0, inMain.stderr);
  assert.equal(decisionOf(inMain), 'deny');
  assert.match(reasonOf(inMain), /tests\/support\/fixture\.ts matches the test glob tests\/\*\*/);
  const inSlice = hook('test-frozen.mjs', edit(worktree, 'projects/a/tests/support/fixture.ts'), { projectDir: dir });
  assert.equal(decisionOf(inSlice), 'deny');
  // Code stays editable.
  assert.equal(decisionOf(hook('test-frozen.mjs', edit(worktree, 'projects/a/src/app.ts'), { projectDir: dir })), 'allow');
});

test('verified-before-stop: a slice worktree under projects/a reads and names the host projects/a, not the repository root', () => {
  const { dir, worktree } = subfolderHost();
  const blocked = hook('verified-before-stop.mjs', { hook_event_name: 'Stop', cwd: worktree, stop_hook_active: false }, { projectDir: dir });
  assert.equal(blocked.status, 0, blocked.stderr);
  assert.equal(blocked.decision.decision, 'block');
  assert.ok(blocked.decision.reason.includes(`--project "${realpathSync(dir)}"`), blocked.decision.reason);

  const head = gitIn(worktree, ['rev-parse', 'HEAD']);
  const verify = path.join(dir, '.forge', 'verify');
  mkdirSync(verify, { recursive: true });
  const runs = [{ name: 'test', command: 'true', exitCode: 0, ms: 1, tail: '' }];
  writeFileSync(path.join(verify, 'x-01.json'), JSON.stringify({ slice: 'x-01', head, at: new Date().toISOString(), green: true, runs }));
  const through = hook('verified-before-stop.mjs', { hook_event_name: 'Stop', cwd: worktree, stop_hook_active: false }, { projectDir: dir });
  assert.deepEqual(through.decision, {});
});

test('effort-state: artifacts on the effort branch are read under the host folder, PR.md included', () => {
  const { repo, dir } = subfolderHost();
  writeFileSync(path.join(dir, 'docs', 'efforts', 'x', 'plan.md'), '# Plan\n');
  writeFileSync(path.join(dir, 'docs', 'efforts', 'x', 'PR.md'), '# PR\n\n## Evidence\n\nproofs green\n');
  gitIn(repo, ['add', '-A']);
  gitIn(repo, ['commit', '-q', '-m', 'plan and PR']);
  const bin = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'plugins', 'forge-sdlc', 'bin', 'effort-state.mjs');
  // No state record, so the stage is derived from the branch's artifacts.
  spawnSync('rm', ['-f', path.join(dir, '.forge', 'state.json')]);
  const r = spawnSync(process.execPath, [bin, 'x'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const found = JSON.parse(r.stdout);
  assert.equal(found.source, 'artifacts');
  assert.equal(found.stage, 'built');
});
