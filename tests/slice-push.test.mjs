// The slice-push guardrail: only the effort branch leaves the host.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bash, decisionOf, forgeMd, hook, host, reasonOf } from './support/host.mjs';

const push = (dir, command) => hook('slice-push.mjs', bash(dir, command));

test('on an initialised host, pushing the effort branch is allowed, by name or bare', () => {
  const { dir } = host({ branch: 'feat/checkout' });
  for (const command of ['git push origin feat/checkout', 'git push', 'git push -u origin HEAD', 'git push origin @']) {
    const r = push(dir, command);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.decision, {}, command);
  }
});

test('on an initialised host, pushing a slice branch is denied with the effort shape in the reason', () => {
  const { dir } = host({ branch: 'slice/checkout-01' });
  for (const command of ['git push origin slice/checkout-01', 'git push', 'git push origin HEAD', 'git push -f origin +slice/checkout-01:slice/checkout-01']) {
    const r = push(dir, command);
    assert.equal(decisionOf(r), 'deny', command);
    assert.match(reasonOf(r), /slice\/checkout-01/);
    assert.match(reasonOf(r), /feat\/<slug>/);
  }
});

test('on an initialised host, any other ref is denied too: only the effort branch is pushed', () => {
  const { dir } = host({ branch: 'fix/typo' });
  assert.equal(decisionOf(push(dir, 'git push origin fix/typo')), 'deny');
  assert.equal(decisionOf(push(dir, 'git push')), 'deny');
  assert.equal(decisionOf(push(dir, 'git push origin main')), 'deny');
});

test('the destination decides: slice content pushed onto the effort ref passes, effort content onto a slice ref does not', () => {
  const { dir } = host({ branch: 'slice/x-01' });
  assert.deepEqual(push(dir, 'git push origin slice/x-01:feat/x').decision, {});
  assert.equal(decisionOf(push(dir, 'git push origin feat/x:refs/heads/slice/x-01')), 'deny');
});

test('--all and --mirror are denied on an initialised host', () => {
  const { dir } = host({ branch: 'feat/x' });
  for (const command of ['git push --all', 'git push --mirror origin', 'git push origin --branches']) {
    const r = push(dir, command);
    assert.equal(decisionOf(r), 'deny', command);
    assert.match(reasonOf(r), /every branch/);
  }
});

test('deletes and tags pass: cleanup and tags are not branches', () => {
  const { dir } = host({ branch: 'feat/x', tags: ['v1.0.0'] });
  for (const command of [
    'git push origin --delete slice/x-01',
    'git push origin :slice/x-01',
    'git push --tags',
    'git push origin v1.0.0',
    'git push origin refs/tags/v2.0.0',
  ]) {
    assert.deepEqual(push(dir, command).decision, {}, command);
  }
  // a name that is not a tag here is a branch, and only the effort branch is pushed
  assert.equal(decisionOf(push(dir, 'git push origin v9.9.9')), 'deny');
});

test('the effort shape comes from forge.md: effort/<slug> makes effort/x the pushed branch', () => {
  const { dir } = host({ branch: 'effort/x', config: forgeMd(['- effort: effort/<slug>']) });
  assert.deepEqual(push(dir, 'git push origin effort/x').decision, {});
  assert.equal(decisionOf(push(dir, 'git push origin feat/x')), 'deny');
});

test('without forge.md only slice/* is denied, other branches push as before', () => {
  const slice = host({ branch: 'slice/x-01', config: null });
  const r = push(slice.dir, 'git push');
  assert.equal(decisionOf(r), 'deny');
  assert.match(reasonOf(r), /slice branch/);
  const other = host({ branch: 'fix/typo', config: null });
  assert.deepEqual(push(other.dir, 'git push origin fix/typo').decision, {});
  assert.deepEqual(push(other.dir, 'git push origin main').decision, {});
});

test('without forge.md --all is denied only while a local slice branch exists', () => {
  const clean = host({ branch: 'feat/x', config: null });
  assert.deepEqual(push(clean.dir, 'git push --all').decision, {});
  const withSlice = host({ branch: 'feat/x', config: null, branches: ['slice/x-01'] });
  assert.equal(decisionOf(push(withSlice.dir, 'git push --all')), 'deny');
});

test('a cd or -C earlier in the command moves the push to that checkout', () => {
  const effort = host({ branch: 'feat/x' });
  const slice = host({ branch: 'slice/x-01' });
  assert.equal(decisionOf(push(effort.dir, `cd ${slice.dir} && git push`)), 'deny');
  assert.equal(decisionOf(push(effort.dir, `git -C ${slice.dir} push origin HEAD`)), 'deny');
  assert.deepEqual(push(slice.dir, `git -C ${effort.dir} push`).decision, {});
});

test('a command with several pushes is denied when any of them offends', () => {
  const { dir } = host({ branch: 'feat/x', branches: ['slice/x-01'] });
  assert.equal(decisionOf(push(dir, 'git push origin feat/x; git push origin slice/x-01')), 'deny');
});

test('non-push commands and non-Bash tools are allowed', () => {
  const { dir } = host({ branch: 'slice/x-01' });
  assert.deepEqual(push(dir, 'git fetch origin && git log --oneline').decision, {});
  assert.deepEqual(push(dir, 'echo git push').decision, {});
  assert.deepEqual(hook('slice-push.mjs', { tool_name: 'Edit', tool_input: { file_path: `${dir}/a.ts` }, cwd: dir }).decision, {});
});

test('never answers ask', () => {
  const { dir } = host({ branch: 'slice/x-01' });
  for (const command of ['git push', 'git push origin feat/x', 'ls']) {
    assert.notEqual(decisionOf(push(dir, command)), 'ask');
  }
});
