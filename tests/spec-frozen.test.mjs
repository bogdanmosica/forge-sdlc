// The spec-frozen guardrail: once an effort builds, its intent, spec and plan are read-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { bash, decisionOf, edit, hook, host, reasonOf } from './support/host.mjs';

const building = (stage = 'build') => {
  const { dir } = host({ branch: 'feat/x' });
  writeState(dir, { efforts: { x: { stage, gate: 'none', branch: 'feat/x' } } });
  return { dir };
};

const frozen = (dir, rel, tool = 'Edit') => hook('spec-frozen.mjs', { ...edit(dir, rel), tool_name: tool });

test('an Edit to spec.md of an effort in stage build is denied; the reason names the path, the stage and the way out', () => {
  const { dir } = building();
  const r = frozen(dir, 'docs/efforts/x/spec.md');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(decisionOf(r), 'deny');
  assert.match(reasonOf(r), /docs\/efforts\/x\/spec\.md/);
  assert.match(reasonOf(r), /\bbuild\b/);
  assert.match(reasonOf(r), /fix the code/i);
  assert.match(reasonOf(r), /reopen the gate/i);
});

test('intent.md and plan.md are frozen too, for Edit and Write', () => {
  const { dir } = building();
  for (const rel of ['docs/efforts/x/intent.md', 'docs/efforts/x/plan.md']) {
    for (const tool of ['Edit', 'Write']) {
      const r = frozen(dir, rel, tool);
      assert.equal(decisionOf(r), 'deny', `${tool} ${rel}`);
      assert.match(reasonOf(r), new RegExp(rel.replace(/\./g, '\\.')));
    }
  }
});

test('stage built freezes as well; stages before build leave the artifacts editable', () => {
  assert.equal(decisionOf(frozen(building('built').dir, 'docs/efforts/x/spec.md')), 'deny');
  for (const stage of ['map', 'intent', 'spec', 'plan']) {
    const r = frozen(building(stage).dir, 'docs/efforts/x/spec.md');
    assert.deepEqual(r.decision, {}, stage);
  }
});

test('map.md stays live, and another effort folder is untouched', () => {
  const { dir } = building();
  assert.deepEqual(frozen(dir, 'docs/efforts/x/map.md').decision, {});
  assert.deepEqual(frozen(dir, 'docs/efforts/y/spec.md').decision, {});
  assert.deepEqual(frozen(dir, 'docs/efforts/x/notes/spec.md').decision, {});
  assert.deepEqual(frozen(dir, 'src/spec.md').decision, {});
});

test('the same file inside a slice worktree of the host is frozen: the path tail decides', () => {
  const { dir } = building();
  const r = frozen(dir, '.forge/worktrees/x-01/docs/efforts/x/spec.md');
  assert.equal(decisionOf(r), 'deny');
});

/** A building host whose effort branch carries spec.md, with a slice worktree x-01 cut from it; `{ dir, worktree }`. */
function memberHost() {
  const { dir } = building();
  const git = (args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  mkdirSync(path.join(dir, 'docs', 'efforts', 'x'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'efforts', 'x', 'spec.md'), '# Spec\n');
  git(['add', 'docs/efforts/x/spec.md']);
  git(['commit', '-q', '-m', 'spec']);
  const worktree = path.join(dir, '.forge', 'worktrees', 'x-01');
  git(['worktree', 'add', '-q', '-b', 'slice/x-01', worktree]);
  return { dir, worktree };
}

test('a session whose project dir is a slice worktree reads the host state through git: the spec is still frozen', () => {
  const { worktree } = memberHost();
  const r = hook('spec-frozen.mjs', edit(worktree, 'docs/efforts/x/spec.md'), { projectDir: worktree });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(decisionOf(r), 'deny');
  assert.match(reasonOf(r), /docs\/efforts\/x\/spec\.md is frozen: effort x is in stage build/);
  assert.deepEqual(hook('spec-frozen.mjs', edit(worktree, 'docs/efforts/x/map.md'), { projectDir: worktree }).decision, {});
});

test('outside a repository the state is read from the project dir', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'forge-norepo-'));
  writeState(dir, { efforts: { x: { stage: 'build', gate: 'none' } } });
  assert.equal(decisionOf(frozen(dir, 'docs/efforts/x/spec.md')), 'deny');
});

test('no state file: nothing is frozen', () => {
  const { dir } = host({ branch: 'feat/x' });
  const r = frozen(dir, 'docs/efforts/x/spec.md');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
});

test('a malformed state file is an error on stderr, never a decision', () => {
  const { dir } = host({ branch: 'feat/x' });
  mkdirSync(path.join(dir, '.forge'), { recursive: true });
  writeFileSync(path.join(dir, '.forge', 'state.json'), '{not json');
  const r = frozen(dir, 'docs/efforts/x/spec.md');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /state\.json/);
});

test('other tools and an empty payload are allowed', () => {
  const { dir } = building();
  assert.deepEqual(hook('spec-frozen.mjs', bash(dir, 'cat docs/efforts/x/spec.md')).decision, {});
  const r = hook('spec-frozen.mjs', {}, { projectDir: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
});

test('never answers ask', () => {
  const { dir } = building();
  for (const rel of ['docs/efforts/x/spec.md', 'docs/efforts/x/map.md', 'src/a.ts']) {
    assert.notEqual(decisionOf(frozen(dir, rel)), 'ask');
  }
});
