// bin/slice-worktree.mjs: where a slice's worktree lives (beside the repository, ADR 0022) and,
// with --add, cutting it from the effort branch and running the host's `## Worktrees` install
// there. `dependency_dir` is no longer read: a value other than none is a config problem, and with
// no `install` the cut is refused rather than leaving a worktree without dependencies silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseForgeConfig, worktreeInstall } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { forgeMd, host } from './support/host.mjs';

const { parseWorktrees } = await import('../plugins/forge-sdlc/hooks/run-pane/worktrees.ts');

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'bin', 'slice-worktree.mjs');
const cli = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
const worktreesMd = (lines) => `${forgeMd()}\n## Worktrees\n${lines.join('\n')}\n`;
const beside = (repo, slice) => path.join(path.dirname(realpathSync(repo)), `${path.basename(repo)}-worktrees`, slice);

test('worktreeInstall: the install command, none or absent as no install, and dependency_dir as a problem unless none', () => {
  const read = (lines) => worktreeInstall(parseForgeConfig(worktreesMd(lines)));
  assert.deepEqual(read(['- install: pnpm install --frozen-lockfile   # at the worktree root']), { command: 'pnpm install --frozen-lockfile', problems: [] });
  assert.deepEqual(read(['- install: none']), { command: null, problems: [] });
  assert.deepEqual(read([]), { command: null, problems: [] });
  assert.deepEqual(worktreeInstall(null), { command: null, problems: [] });
  assert.deepEqual(read(['- dependency_dir: none', '- install: pnpm i']), { command: 'pnpm i', problems: [] });
  const stale = read(['- dependency_dir: node_modules']);
  assert.equal(stale.command, null);
  assert.equal(stale.problems.length, 1);
  assert.match(stale.problems[0], /dependency_dir is no longer read/);
  assert.match(stale.problems[0], /install:/);
  assert.equal(read(['- dependency_dir: node_modules', '- install: npm ci']).problems.length, 1);
});

test('the run pane reads ## Worktrees as the hooks do', () => {
  for (const lines of [[], ['- install: none'], ['- install: npm ci'], ['- dependency_dir: none', '- install: pnpm i'], ['- dependency_dir: .venv']]) {
    const config = parseForgeConfig(worktreesMd(lines));
    const hooks = worktreeInstall(config);
    assert.deepEqual(parseWorktrees(config), { install: hooks.command, problems: hooks.problems }, lines.join(' | '));
  }
  assert.deepEqual(parseWorktrees(undefined), { install: null, problems: [] });
});

test('the path: beside the main checkout, from the host or a subfolder of it', () => {
  const { dir } = host({ branch: 'feat/x' });
  const r = cli(['x-01', '--project', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `${beside(dir, 'x-01')}\n`);
  mkdirSync(path.join(dir, 'src'));
  assert.equal(cli(['x-01'], path.join(dir, 'src')).stdout, `${beside(dir, 'x-01')}\n`);
});

test('bad usage exits 2: no slice, a slice not <slug>-<nn>, outside a repository', () => {
  assert.equal(cli([]).status, 2);
  assert.equal(cli(['x']).status, 2);
  assert.equal(cli(['x-01', '--project', path.parse(process.cwd()).root]).status, 2);
});

test('--add cuts slice/<slug>-<nn> from feat/<slug> beside the repository and runs the install at its root', () => {
  const { dir } = host({ branch: 'feat/x', config: worktreesMd(['- install: echo installed > .installed']) });
  const r = cli(['x-01', '--project', dir, '--add']);
  assert.equal(r.status, 0, r.stderr);
  const worktree = beside(dir, 'x-01');
  assert.equal(r.stdout, `${worktree}\n`);
  assert.equal(spawnSync('git', ['-C', worktree, 'branch', '--show-current'], { encoding: 'utf8' }).stdout.trim(), 'slice/x-01');
  assert.equal(readFileSync(path.join(worktree, '.installed'), 'utf8'), 'installed\n');
  assert.ok(!existsSync(path.join(worktree, 'node_modules')), 'nothing is symlinked');
});

test('--add from a subfolder host runs the install at the worktree root, not the host folder', () => {
  const { dir: repo } = host({ config: null });
  const dir = path.join(repo, 'projects', 'a');
  mkdirSync(path.join(dir, 'docs', 'agents'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'agents', 'forge.md'), worktreesMd(['- dependency_dir: none', '- install: pwd > .where']));
  for (const args of [['add', '-A'], ['commit', '-q', '-m', 'host'], ['switch', '-q', '-c', 'feat/x']]) spawnSync('git', ['-C', repo, ...args]);
  mkdirSync(path.join(repo, 'node_modules'));
  const r = cli(['x-01', '--add'], dir);
  assert.equal(r.status, 0, r.stderr);
  const worktree = beside(repo, 'x-01');
  assert.equal(realpathSync(readFileSync(path.join(worktree, '.where'), 'utf8').trim()), worktree);
  assert.equal(r.stderr, '', 'no config problem for dependency_dir: none');
  assert.ok(!existsSync(path.join(worktree, 'node_modules')) || !lstatSync(path.join(worktree, 'node_modules')).isSymbolicLink());
});

test('--add with no install and no dependency_dir cuts the worktree without installing; an existing worktree is reused', () => {
  const { dir } = host({ branch: 'feat/x' });
  assert.equal(cli(['x-01', '--project', dir, '--add']).status, 0);
  const again = cli(['x-01', '--project', dir, '--add']);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(again.stdout, `${beside(dir, 'x-01')}\n`);
});

test('--add: a failing install exits 1 and names the command; a stale dependency_dir without install is refused with exit 2', () => {
  const failing = host({ branch: 'feat/x', config: worktreesMd(['- install: exit 3']) });
  const r = cli(['x-01', '--project', failing.dir, '--add']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /install `exit 3` exited 3/);

  const stale = host({ branch: 'feat/x', config: worktreesMd(['- dependency_dir: node_modules']) });
  const refused = cli(['x-01', '--project', stale.dir, '--add']);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /dependency_dir is no longer read/);
  assert.ok(!existsSync(beside(stale.dir, 'x-01')), 'no worktree cut');
});
