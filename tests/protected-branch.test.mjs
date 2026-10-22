// The protected-branch guardrail at the stdin/stdout boundary, against fixture hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { bash, decisionOf, edit, forgeMd, hook, host, reasonOf } from './support/host.mjs';

test('an Edit on main is denied with a reason naming the branch and the config', () => {
  const { dir } = host({ branch: 'main' });
  const r = hook('protected-branch.mjs', edit(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(decisionOf(r), 'deny');
  assert.match(reasonOf(r), /\bmain\b/);
  assert.match(reasonOf(r), /forge\.md/);
  assert.match(reasonOf(r), /feat\/<slug>/);
});

test('the same Edit on feat/x is allowed', () => {
  const { dir } = host({ branch: 'feat/x' });
  const r = hook('protected-branch.mjs', edit(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
});

test('a Write into a folder that does not exist yet resolves the branch from its parent', () => {
  const { dir } = host({ branch: 'main' });
  const r = hook('protected-branch.mjs', { ...edit(dir, 'src/new/deep/File.ts'), tool_name: 'Write' });
  assert.equal(decisionOf(r), 'deny');
});

test('git commit on main is denied, a non-commit command is not', () => {
  const { dir } = host({ branch: 'main' });
  const denied = hook('protected-branch.mjs', bash(dir, 'git add -A && git commit -m "x"'));
  assert.equal(decisionOf(denied), 'deny');
  assert.match(reasonOf(denied), /Commits/);
  assert.deepEqual(hook('protected-branch.mjs', bash(dir, 'git status')).decision, {});
  assert.deepEqual(hook('protected-branch.mjs', bash(dir, 'git push origin main')).decision, {});
});

test('a protected glob in forge.md covers release/1.2', () => {
  const { dir } = host({ branch: 'release/1.2', config: forgeMd(['- protected: main, release/*']) });
  const r = hook('protected-branch.mjs', edit(dir));
  assert.equal(decisionOf(r), 'deny');
  assert.match(reasonOf(r), /release\/1\.2/);
});

test('without forge.md the default branch is still protected when it can be told', () => {
  const { dir } = host({ branch: 'main', config: null });
  const r = hook('protected-branch.mjs', edit(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(decisionOf(r), 'deny');
  assert.match(reasonOf(r), /the default branch/);
});

test('without forge.md a repo whose only branch is trunk cannot be told apart, so the call proceeds', () => {
  const { dir } = host({ branch: 'trunk', initial: 'trunk', config: null });
  assert.deepEqual(hook('protected-branch.mjs', edit(dir)).decision, {});
});

test('forge.md names trunk as the default, so an edit on trunk is denied', () => {
  const { dir } = host({ branch: 'trunk', initial: 'trunk', config: forgeMd().replace('- default: main', '- default: trunk') });
  assert.equal(decisionOf(hook('protected-branch.mjs', edit(dir))), 'deny');
});

test('the file decides the repository, not cwd: an edit in a worktree on feat/x passes', () => {
  const main = host({ branch: 'main' });
  const feature = host({ branch: 'feat/x' });
  const r = hook('protected-branch.mjs', { ...edit(feature.dir), cwd: main.dir }, { projectDir: main.dir });
  assert.deepEqual(r.decision, {});
});

test('git -C <dir> commit is checked against the checkout in <dir>, not cwd', () => {
  const main = host({ branch: 'main' });
  const feature = host({ branch: 'feat/x' });
  const rel = path.relative(feature.dir, main.dir);
  for (const command of [
    `git -C ${main.dir} commit -m x`,
    `git -C "${rel}" commit -m x`,
    `cd /tmp && git -c user.name=t -C ${main.dir} commit -am x`,
  ]) {
    const r = hook('protected-branch.mjs', bash(feature.dir, command), { projectDir: feature.dir });
    assert.equal(decisionOf(r), 'deny', command);
  }
  const back = hook('protected-branch.mjs', bash(main.dir, `git -C ${feature.dir} commit -m x`), { projectDir: main.dir });
  assert.deepEqual(back.decision, {});
});

test('outside a git repository the call proceeds', () => {
  const r = hook('protected-branch.mjs', edit('/'), { projectDir: '/' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
});

test('an empty payload is allowed, never an error', () => {
  const r = hook('protected-branch.mjs', {}, { projectDir: '/', cwd: '/' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
});

test('never answers ask', () => {
  const { dir } = host({ branch: 'main' });
  for (const p of [edit(dir), bash(dir, 'git commit -m x'), bash(dir, 'ls')]) {
    assert.notEqual(decisionOf(hook('protected-branch.mjs', p)), 'ask');
  }
});
