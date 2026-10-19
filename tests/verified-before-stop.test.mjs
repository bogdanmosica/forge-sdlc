// The verified-before-stop gate at the stdin/stdout boundary: Stop and SubagentStop in a slice
// worktree block until .forge/verify/<slice>.json is green at the worktree's HEAD; three denials,
// then the stop passes and the slice is red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { forgeMd, hook, host } from './support/host.mjs';
import { readState, writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';

const HOOK = 'verified-before-stop.mjs';

const gitIn = (dir, args) => {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

/** A host with a slice worktree for demo-01; `{ dir, worktree }`. */
function sliceHost() {
  const { dir } = host({ config: forgeMd() });
  const worktree = path.join(dir, '.forge', 'worktrees', 'demo-01');
  gitIn(dir, ['worktree', 'add', '-q', '-b', 'slice/demo-01', worktree]);
  return { dir, worktree };
}

const verifyDir = (dir) => path.join(dir, '.forge', 'verify');

/** Write the verify record for demo-01 by hand. */
function record(dir, { head, green = true }) {
  mkdirSync(verifyDir(dir), { recursive: true });
  const runs = [{ name: 'test', command: 'true', exitCode: green ? 0 : 1, ms: 1, tail: '' }];
  writeFileSync(path.join(verifyDir(dir), 'demo-01.json'), JSON.stringify({ slice: 'demo-01', head, at: new Date().toISOString(), green, runs }));
}

const stop = (cwd, extra = {}) => ({ hook_event_name: 'Stop', cwd, stop_hook_active: false, ...extra });
const commit = (dir) => gitIn(dir, ['commit', '-q', '--allow-empty', '-m', 'more']);

test('no record: the stop is blocked and the reason is the verify-record command', () => {
  const { dir, worktree } = sliceHost();
  const r = hook(HOOK, stop(worktree), { projectDir: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, 'block');
  assert.match(r.decision.reason, /bin\/verify-record\.mjs/);
  assert.match(r.decision.reason, /--slice demo-01/);
  assert.ok(r.decision.reason.includes(`--worktree "${realpathSync(worktree)}"`));
  assert.ok(r.decision.reason.includes(`--project "${realpathSync(dir)}"`));
});

test('a green record at the current HEAD lets the stop through', () => {
  const { dir, worktree } = sliceHost();
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']) });
  assert.deepEqual(hook(HOOK, stop(worktree), { projectDir: dir }).decision, {});
});

test('SubagentStop is gated the same way', () => {
  const { dir, worktree } = sliceHost();
  assert.equal(hook(HOOK, stop(worktree, { hook_event_name: 'SubagentStop' }), { projectDir: dir }).decision.decision, 'block');
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']) });
  assert.deepEqual(hook(HOOK, stop(worktree, { hook_event_name: 'SubagentStop' }), { projectDir: dir }).decision, {});
});

test('a commit after the run makes the record stale: blocked', () => {
  const { dir, worktree } = sliceHost();
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']) });
  commit(worktree);
  const r = hook(HOOK, stop(worktree), { projectDir: dir });
  assert.equal(r.decision.decision, 'block');
  assert.match(r.decision.reason, /stale/);
});

test('a red record at HEAD is blocked', () => {
  const { dir, worktree } = sliceHost();
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']), green: false });
  const r = hook(HOOK, stop(worktree), { projectDir: dir });
  assert.equal(r.decision.decision, 'block');
  assert.match(r.decision.reason, /red/);
});

test('the record is found under the main checkout when the project dir is the worktree', () => {
  const { dir, worktree } = sliceHost();
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']) });
  assert.deepEqual(hook(HOOK, stop(worktree), { projectDir: worktree }).decision, {});
});

test('a member that cd-ed into a subfolder of the worktree is gated: blocked without a record, through with a green one', () => {
  const { dir, worktree } = sliceHost();
  const sub = path.join(worktree, 'src', 'deep');
  mkdirSync(sub, { recursive: true });
  const r = hook(HOOK, stop(sub), { projectDir: worktree });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, 'block');
  assert.ok(r.decision.reason.includes(`--worktree "${realpathSync(worktree)}"`));
  assert.ok(r.decision.reason.includes(`--project "${realpathSync(dir)}"`));
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']) });
  assert.deepEqual(hook(HOOK, stop(sub), { projectDir: worktree }).decision, {});
});

test('after three denials the fourth stop passes, the slice is marked red in state', () => {
  const { dir, worktree } = sliceHost();
  writeState(dir, { efforts: { demo: { stage: 'build', gate: 'none', slices: { 'demo-01': { status: 'building', ticket: '#1' } } } } });
  for (let i = 1; i <= 3; i += 1) {
    const r = hook(HOOK, stop(worktree), { projectDir: dir });
    assert.equal(r.decision.decision, 'block', `denial ${i}`);
    assert.match(r.decision.reason, new RegExp(`${i} of 3`));
  }
  const r = hook(HOOK, stop(worktree), { projectDir: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, undefined);
  assert.match(r.decision.systemMessage, /demo-01/);
  assert.match(r.decision.systemMessage, /red/);
  assert.deepEqual(readState(dir).efforts.demo.slices['demo-01'], { status: 'red', ticket: '#1' });
});

test('three denials without state: the stop passes, no state file is created', () => {
  const { dir, worktree } = sliceHost();
  for (let i = 0; i < 3; i += 1) hook(HOOK, stop(worktree), { projectDir: dir });
  assert.match(hook(HOOK, stop(worktree), { projectDir: dir }).decision.systemMessage, /red/);
  assert.equal(readState(dir), null);
});

test('a green stop clears the denial count', () => {
  const { dir, worktree } = sliceHost();
  hook(HOOK, stop(worktree), { projectDir: dir });
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']) });
  assert.deepEqual(hook(HOOK, stop(worktree), { projectDir: dir }).decision, {});
  assert.ok(!existsSync(path.join(verifyDir(dir), 'demo-01.denials')));
});

test('denials are counted per slice in a file beside the record', () => {
  const { dir, worktree } = sliceHost();
  hook(HOOK, stop(worktree), { projectDir: dir });
  hook(HOOK, stop(worktree), { projectDir: dir });
  assert.equal(readFileSync(path.join(verifyDir(dir), 'demo-01.denials'), 'utf8').trim(), '2');
});

test('stop_hook_active does not quiet the gate: the count is the loop guard', () => {
  const { dir, worktree } = sliceHost();
  for (let i = 1; i <= 3; i += 1) {
    const r = hook(HOOK, stop(worktree, { stop_hook_active: i > 1 }), { projectDir: dir });
    assert.equal(r.decision.decision, 'block', `denial ${i}`);
    assert.match(r.decision.reason, new RegExp(`${i} of 3`));
  }
  const r = hook(HOOK, stop(worktree, { stop_hook_active: true }), { projectDir: dir });
  assert.equal(r.decision.decision, undefined);
  assert.match(r.decision.systemMessage, /red/);
});

test('the pass after three denials resets the count: the next stop blocks again at 1 of 3', () => {
  const { dir, worktree } = sliceHost();
  for (let i = 0; i < 4; i += 1) hook(HOOK, stop(worktree, { stop_hook_active: true }), { projectDir: dir });
  assert.ok(!existsSync(path.join(verifyDir(dir), 'demo-01.denials')));
  const r = hook(HOOK, stop(worktree, { stop_hook_active: true }), { projectDir: dir });
  assert.equal(r.decision.decision, 'block');
  assert.match(r.decision.reason, /1 of 3/);
});

test('quiet outside a slice worktree: the effort branch and main', () => {
  for (const branch of ['feat/demo', 'main']) {
    const { dir } = host({ branch });
    assert.deepEqual(hook(HOOK, stop(dir)).decision, {}, branch);
  }
});

test('quiet outside a repository and on an empty payload', () => {
  const r = hook(HOOK, stop('/'), { projectDir: '/' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
  // An empty payload falls back to the process cwd: run it outside a repo, not in the checkout running the tests.
  assert.deepEqual(hook(HOOK, {}, { projectDir: '/', cwd: '/' }).decision, {});
});

// The agent-id branch: a subagent's SubagentStop carries the lead's root as cwd, never the
// worktree it cd-ed into, so the slice is found by the `agent` the lead recorded on it.
const AGENT = 'a7f3c9e2b1d04';

/** A host on feat/demo with a slice worktree for demo-01 whose `agent` is AGENT; `{ dir, worktree }`. */
function agentHost(slice = { status: 'building', ticket: '#1', agent: AGENT }) {
  const { dir } = host({ branch: 'feat/demo', config: forgeMd() });
  const worktree = path.join(dir, '.forge', 'worktrees', 'demo-01');
  gitIn(dir, ['worktree', 'add', '-q', '-b', 'slice/demo-01', worktree]);
  writeState(dir, { efforts: { demo: { stage: 'build', gate: 'none', slices: { 'demo-01': slice } } } });
  return { dir, worktree };
}

const subagentStop = (cwd, agent_id = AGENT, extra = {}) => stop(cwd, { hook_event_name: 'SubagentStop', agent_id, ...extra });

test('SubagentStop from the host with a matching agent_id: blocked without a record, naming the worktree and the host, never the agent id', () => {
  const { dir, worktree } = agentHost();
  const r = hook(HOOK, subagentStop(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, 'block');
  assert.match(r.decision.reason, /^Slice demo-01 \(branch slice\/demo-01\) has no green verify record at HEAD [0-9a-f]{12}: no record/);
  assert.ok(r.decision.reason.includes(`--worktree "${realpathSync(worktree)}"`));
  assert.ok(r.decision.reason.includes(`--project "${realpathSync(dir)}"`));
  assert.ok(!r.decision.reason.includes(AGENT));
});

test('SubagentStop with a matching agent_id: a green record at the worktree HEAD lets it through and clears the denials', () => {
  const { dir, worktree } = agentHost();
  assert.equal(hook(HOOK, subagentStop(dir)).decision.decision, 'block');
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']) });
  assert.deepEqual(hook(HOOK, subagentStop(dir)).decision, {});
  assert.ok(!existsSync(path.join(verifyDir(dir), 'demo-01.denials')));
});

test('SubagentStop with a matching agent_id: three blocks, then the red pass marks the slice red and clears its agent', () => {
  const { dir } = agentHost();
  for (let i = 1; i <= 3; i += 1) {
    const r = hook(HOOK, subagentStop(dir));
    assert.equal(r.decision.decision, 'block', `denial ${i}`);
    assert.match(r.decision.reason, new RegExp(`${i} of 3`));
  }
  const r = hook(HOOK, subagentStop(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, undefined);
  assert.match(r.decision.systemMessage, /Slice demo-01 stops red/);
  assert.ok(!r.decision.systemMessage.includes(AGENT));
  assert.deepEqual(readState(dir).efforts.demo.slices['demo-01'], { status: 'red', ticket: '#1' });
});

test('the agent-id branch allows: an unmatched agent_id, a Stop payload with an agent_id, a matched slice whose worktree is gone', () => {
  const { dir } = agentHost();
  assert.deepEqual(hook(HOOK, subagentStop(dir, 'someone-else')).decision, {}, 'unmatched');
  assert.deepEqual(hook(HOOK, stop(dir, { agent_id: AGENT })).decision, {}, 'Stop with an agent_id');
  assert.deepEqual(hook(HOOK, subagentStop(dir, '')).decision, {}, 'empty agent_id');
  gitIn(dir, ['worktree', 'remove', '--force', path.join(dir, '.forge', 'worktrees', 'demo-01')]);
  assert.deepEqual(hook(HOOK, subagentStop(dir)).decision, {}, 'worktree gone');
  assert.ok(!existsSync(path.join(verifyDir(dir), 'demo-01.denials')));
});

test('the agent-id branch finds the host through git from a cwd inside it, whatever the project dir', () => {
  const { dir, worktree } = agentHost();
  const sub = path.join(dir, 'docs');
  const r = hook(HOOK, subagentStop(sub), { projectDir: '/' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, 'block');
  assert.ok(r.decision.reason.includes(`--worktree "${realpathSync(worktree)}"`));
});

test('the agent-id branch falls back to the project dir when the cwd is outside a repository', () => {
  const { dir } = agentHost();
  const r = hook(HOOK, subagentStop('/'), { projectDir: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.decision.decision, 'block');
  assert.match(r.decision.reason, /^Slice demo-01 /);
});

test('the cwd branch stays first: a slice checkout is gated on its own slice, whatever slice the agent_id names', () => {
  const { dir, worktree } = agentHost({ status: 'building', ticket: '#1' });
  gitIn(dir, ['worktree', 'add', '-q', '-b', 'slice/demo-02', path.join(dir, '.forge', 'worktrees', 'demo-02')]);
  const state = readState(dir);
  state.efforts.demo.slices['demo-02'] = { status: 'building', ticket: '#2', agent: AGENT };
  writeState(dir, state);
  record(dir, { head: gitIn(worktree, ['rev-parse', 'HEAD']) });
  assert.deepEqual(hook(HOOK, subagentStop(worktree), { projectDir: dir }).decision, {});
});
