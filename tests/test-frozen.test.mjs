// The test-frozen guardrail: in fix mode the failing test is the spec, so test files are read-only.
// Inside a slice worktree the slice's mode decides; in the main checkout the effort's mode does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { matchesPath, writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { bash, decisionOf, edit, hook, host, reasonOf } from './support/host.mjs';

const HOOK = 'test-frozen.mjs';
const config = (globs = '**/*.test.*, **/*.spec.*, tests/**') =>
  ['# forge-sdlc host config', '', '## Branches', '- default: main', '', '## Test file globs', `- globs: ${globs}`, ''].join('\n');

/** A host on feat/x with a slice worktree for x-01 and x-02; `effort` and `slices` set the modes. */
function fixture({ effort = 'normal', slices = {}, globs } = {}) {
  const { dir } = host({ branch: 'feat/x', config: config(globs) });
  for (const nn of ['01', '02']) {
    const wt = path.join(dir, '.forge', 'worktrees', `x-${nn}`);
    const r = spawnSync('git', ['-C', dir, 'worktree', 'add', '-q', '-b', `slice/x-${nn}`, wt], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
  const sliceRecords = Object.fromEntries(['x-01', 'x-02'].map((s) => [s, { status: 'building', mode: slices[s] ?? 'normal' }]));
  writeState(dir, { efforts: { x: { stage: 'build', gate: 'none', mode: effort, branch: 'feat/x', slices: sliceRecords } } });
  return { dir, wt: (nn) => `.forge/worktrees/x-${nn}` };
}

const frozen = (dir, rel, tool = 'Edit') => hook(HOOK, { ...edit(dir, rel), tool_name: tool });

test('matchesPath: ** spans folders and may match none, * stays in one segment', () => {
  assert.ok(matchesPath('a.test.ts', '**/*.test.*'));
  assert.ok(matchesPath('src/deep/a.test.ts', '**/*.test.*'));
  assert.ok(matchesPath('tests/a/b.ts', 'tests/**'));
  assert.ok(matchesPath('src/a.ts', 'src/*.ts'));
  assert.ok(!matchesPath('src/x/a.ts', 'src/*.ts'));
  assert.ok(!matchesPath('src/a.ts', '**/*.test.*'));
  assert.ok(!matchesPath('srcXa.ts', 'src.a.ts'));
});

test('main checkout, effort in fix mode: an Edit or Write to a test file is denied; the reason names path, glob and the way out', () => {
  const { dir } = fixture({ effort: 'fix' });
  for (const tool of ['Edit', 'Write']) {
    const r = frozen(dir, 'src/cart.test.ts', tool);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(decisionOf(r), 'deny', tool);
    assert.match(reasonOf(r), /src\/cart\.test\.ts/);
    assert.match(reasonOf(r), /\*\*\/\*\.test\.\*/);
    assert.match(reasonOf(r), /fix the code/i);
    assert.match(reasonOf(r), /failing test is the spec/i);
  }
  assert.equal(decisionOf(frozen(dir, 'tests/helpers/db.ts')), 'deny');
});

test('main checkout in fix mode: code files stay editable', () => {
  const { dir } = fixture({ effort: 'fix' });
  assert.deepEqual(frozen(dir, 'src/cart.ts').decision, {});
});

test('slice worktree: only the slice in fix mode has frozen tests; other slices and the main checkout keep editing', () => {
  const { dir, wt } = fixture({ slices: { 'x-01': 'fix' } });
  const r = frozen(dir, `${wt('01')}/src/cart.test.ts`);
  assert.equal(decisionOf(r), 'deny');
  assert.match(reasonOf(r), /src\/cart\.test\.ts/);
  assert.match(reasonOf(r), /x-01/);
  assert.deepEqual(frozen(dir, `${wt('02')}/src/cart.test.ts`).decision, {});
  assert.deepEqual(frozen(dir, 'src/cart.test.ts').decision, {});
});

test('the effort in fix mode does not freeze a slice worktree whose own mode is normal', () => {
  const { dir, wt } = fixture({ effort: 'fix' });
  assert.deepEqual(frozen(dir, `${wt('01')}/src/cart.test.ts`).decision, {});
});

test('the path is relative to the edited file\'s checkout, so a root glob holds inside a worktree', () => {
  const { dir, wt } = fixture({ slices: { 'x-01': 'fix' }, globs: 'tests/**' });
  assert.equal(decisionOf(frozen(dir, `${wt('01')}/tests/a.ts`)), 'deny');
  assert.deepEqual(frozen(dir, `${wt('01')}/src/tests.ts`).decision, {});
});

test('a new file in a folder that does not exist yet still resolves', () => {
  const { dir } = fixture({ effort: 'fix' });
  assert.equal(decisionOf(frozen(dir, 'src/new/deep/a.spec.js', 'Write')), 'deny');
});

test('normal mode everywhere, no state, no globs: quiet', () => {
  assert.deepEqual(frozen(fixture().dir, 'src/cart.test.ts').decision, {});
  const bare = host({ branch: 'feat/x', config: config() }).dir;
  assert.deepEqual(frozen(bare, 'src/cart.test.ts').decision, {});
  const noGlobs = host({ branch: 'feat/x' }).dir;
  writeState(noGlobs, { efforts: { x: { stage: 'build', mode: 'fix' } } });
  assert.deepEqual(frozen(noGlobs, 'src/cart.test.ts').decision, {});
});

test('a branch that is neither an effort nor a slice branch reads no mode', () => {
  const { dir } = host({ branch: 'chore/y', config: config() });
  writeState(dir, { efforts: { x: { stage: 'build', mode: 'fix' } } });
  assert.deepEqual(frozen(dir, 'src/cart.test.ts').decision, {});
});

test('other tools and an empty payload are allowed', () => {
  const { dir } = fixture({ effort: 'fix' });
  assert.deepEqual(hook(HOOK, bash(dir, 'echo > src/cart.test.ts')).decision, {});
  const r = hook(HOOK, {}, { projectDir: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
});
