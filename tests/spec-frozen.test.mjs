// The spec-frozen guardrail: once an effort builds, its intent, spec and plan are read-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
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
