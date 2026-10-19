// bin/effort-state.mjs: where an effort stands and which command runs next, from .forge/state.json,
// else re-derived from the artifacts committed on feat/<slug> (design section 9: losing state is recoverable).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { forgeMd, host } from './support/host.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'bin', 'effort-state.mjs');

const run = (args, cwd) => {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    json = null;
  }
  return { status: r.status, stderr: r.stderr, json };
};

const git = (dir, args) => {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
};

/** Commit `files` ({ name: text } under docs/efforts/<slug>/) on feat/<slug>, then switch back to main. */
function effortBranch(dir, slug, files) {
  git(dir, ['switch', '-q', '-c', `feat/${slug}`]);
  const folder = path.join(dir, 'docs', 'efforts', slug);
  mkdirSync(folder, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(folder, name), text);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', `${slug} artifacts`]);
  git(dir, ['switch', '-q', 'main']);
}

const effort = (stage, gate, extra = {}) => ({ stage, gate, mode: 'normal', risk: 'normal', branch: 'feat/x', pr: null, slices: {}, updatedAt: '2026-10-17T10:00:00Z', ...extra });

test('state decides: each stage maps to the next command', () => {
  const cases = [
    ['map', 'none', 'map'],
    ['intent', 'intent', 'spec'],
    ['spec', 'spec', 'plan'],
    ['plan', 'plan', 'build'],
    ['build', 'none', 'build'],
    ['built', 'pr', 'none'],
  ];
  for (const [stage, gate, next] of cases) {
    const { dir } = host();
    writeState(dir, { efforts: { x: effort(stage, gate) } });
    const r = run([dir, 'x']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual({ slug: r.json.slug, stage: r.json.stage, gate: r.json.gate, next: r.json.next, source: r.json.source }, { slug: 'x', stage, gate, next, source: 'state' }, stage);
    assert.ok(r.json.why.length > 0);
  }
});

test('state wins over the artifacts on the branch', () => {
  const { dir } = host();
  effortBranch(dir, 'x', { 'map.md': 'm', 'intent.md': 'i', 'spec.md': 's' });
  writeState(dir, { efforts: { x: effort('intent', 'intent') } });
  assert.equal(run([dir, 'x']).json.next, 'spec');
});

test('without state, the artifacts on feat/<slug> decide, even with main checked out', () => {
  const cases = [
    [{ 'map.md': 'm' }, 'map', 'none', 'map'],
    [{ 'map.md': 'm', 'intent.md': 'i' }, 'intent', 'intent', 'spec'],
    [{ 'map.md': 'm', 'intent.md': 'i', 'spec.md': 's' }, 'spec', 'spec', 'plan'],
    [{ 'intent.md': 'i', 'spec.md': 's', 'plan.md': 'p' }, 'plan', 'plan', 'build'],
    [{ 'plan.md': 'p', 'PR.md': '## Intent\n\n## Plan\n' }, 'plan', 'plan', 'build'],
    [{ 'plan.md': 'p', 'PR.md': '## Summary\n\n## Evidence\n\n- x-01 green\n' }, 'built', 'pr', 'none'],
  ];
  for (const [files, stage, gate, next] of cases) {
    const { dir } = host();
    effortBranch(dir, 'x', files);
    const r = run([dir, 'x']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual({ stage: r.json.stage, gate: r.json.gate, next: r.json.next, source: r.json.source }, { stage, gate, next, source: 'artifacts' }, Object.keys(files).join(','));
  }
});

test('a state file holding other efforts still falls back to the branch for this one', () => {
  const { dir } = host();
  effortBranch(dir, 'x', { 'map.md': 'm', 'intent.md': 'i' });
  writeState(dir, { efforts: { other: effort('plan', 'plan') } });
  const r = run([dir, 'x']);
  assert.equal(r.json.source, 'artifacts');
  assert.equal(r.json.next, 'spec');
});

test('an unknown slug exits 1 naming it, with nothing on stdout', () => {
  const { dir } = host();
  const r = run([dir, 'nope']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /nope/);
  assert.equal(r.json, null);
});

test('a feat/<slug> branch with no artifacts is unknown too', () => {
  const { dir } = host({ branches: ['feat/empty'] });
  assert.equal(run([dir, 'empty']).status, 1);
});

test('one argument is the slug, the host is cwd', () => {
  const { dir } = host();
  writeState(dir, { efforts: { x: effort('spec', 'spec') } });
  const r = run(['x'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.next, 'plan');
});

test('--list prints every effort, from state and from feat/* branches, sorted by slug', () => {
  const { dir } = host();
  effortBranch(dir, 'b-branch-only', { 'map.md': 'm', 'intent.md': 'i' });
  writeState(dir, { efforts: { a: effort('plan', 'plan'), c: effort('built', 'pr') } });
  const r = run(['--list', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json.map((e) => [e.slug, e.stage, e.gate, e.next, e.source]), [
    ['a', 'plan', 'plan', 'build', 'state'],
    ['b-branch-only', 'intent', 'intent', 'spec', 'artifacts'],
    ['c', 'built', 'pr', 'none', 'state'],
  ]);
});

test('--list on a host with no effort prints an empty list', () => {
  const { dir } = host();
  const r = run(['--list', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.json, []);
});

/** forge.md text with `- policy: <value>` under ## Gates. */
const withPolicy = (value) => forgeMd().replace('- spec: always', `- policy: ${value}\n- spec: always`);

test('policy: no policy key prints attended', () => {
  const { dir } = host();
  writeState(dir, { efforts: { x: effort('spec', 'spec') } });
  const r = run([dir, 'x']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.policy, 'attended');
});

test('policy: autonomous prints autonomous', () => {
  const { dir } = host({ config: withPolicy('autonomous') });
  writeState(dir, { efforts: { x: effort('spec', 'spec') } });
  const r = run([dir, 'x']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.policy, 'autonomous');
});

test('policy: an unknown value prints attended', () => {
  for (const value of ['maybe', 'Autonomous', 'autonomous-ish']) {
    const { dir } = host({ config: withPolicy(value) });
    writeState(dir, { efforts: { x: effort('spec', 'spec') } });
    const r = run([dir, 'x']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.policy, 'attended', value);
  }
});

test('stop: each reason prints that stop and a why naming it, next unchanged', () => {
  const cases = [
    ['open', /open line waits for the owner/],
    ['flagged', /flagged concern waits for the owner/],
    ['risk-high', /risk high, the effort runs attended/],
  ];
  for (const [stop, why] of cases) {
    const { dir } = host({ config: withPolicy('autonomous') });
    writeState(dir, { efforts: { x: effort('spec', 'spec', { stop }) } });
    const r = run([dir, 'x']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.json.stop, stop);
    assert.match(r.json.why, why, stop);
    assert.equal(r.json.next, 'plan', stop);
  }
});

test('stop: no stop prints none and the stage line as why', () => {
  const { dir } = host({ config: withPolicy('autonomous') });
  writeState(dir, { efforts: { x: effort('spec', 'spec') } });
  const r = run([dir, 'x']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.stop, 'none');
  assert.match(r.json.why, /^Gate 2: running this approves spec\.md$/);
});
