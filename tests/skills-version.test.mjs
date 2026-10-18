// The skills-version tripwire at the SessionStart boundary: quiet when ok or on compaction,
// one warning to the driver and to the model otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { readLock } from '../plugins/forge-sdlc/bin/upstream.mjs';
import { host } from './support/host.mjs';
import { envWith, fakeConfigDir, fakeUpstream, plugin } from './support/upstream.mjs';

const script = path.join(plugin, 'hooks', 'scripts', 'skills-version.mjs');

function start(dir, env, source = 'startup') {
  const payload = { hook_event_name: 'SessionStart', session_id: 's1', source, cwd: dir };
  const r = spawnSync(process.execPath, [script], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...env, CLAUDE_PROJECT_DIR: dir },
  });
  return { status: r.status, stderr: r.stderr, out: JSON.parse(r.stdout || '{}') };
}

test('at the locked version with every heading, the session starts with nothing said', () => {
  const { dir } = host();
  const r = start(dir, envWith({ MATTPOCOCK_SKILLS_ROOT: fakeUpstream({ version: readLock().version }).root }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.out, {});
});

test('on drift, the driver sees a systemMessage and the model gets the same text as context', () => {
  const { dir } = host();
  const r = start(dir, envWith({ MATTPOCOCK_SKILLS_ROOT: fakeUpstream({ version: '1.9.0' }).root }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.out.systemMessage, /1\.9\.0/);
  assert.equal(r.out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(r.out.hookSpecificOutput.additionalContext, r.out.systemMessage);
});

test('when the upstream is not installed, the warning carries the install line', () => {
  const { dir } = host();
  const r = start(dir, envWith({ CLAUDE_CONFIG_DIR: fakeConfigDir([]) }));
  assert.match(r.out.systemMessage, /claude plugin install mattpocock-skills@claude-plugins-official/);
});

test('a lost heading is reported as broken, naming the skill and the heading', () => {
  const { dir } = host();
  const root = fakeUpstream({ version: readLock().version, drop: { skill: 'implement-spec', heading: '## Steps' } }).root;
  const r = start(dir, envWith({ MATTPOCOCK_SKILLS_ROOT: root }));
  assert.match(r.out.systemMessage, /implement-spec: "## Steps"/);
});

test('a compaction is the same session: quiet even on drift', () => {
  const { dir } = host();
  const r = start(dir, envWith({ MATTPOCOCK_SKILLS_ROOT: fakeUpstream({ version: '1.9.0' }).root }), 'compact');
  assert.deepEqual(r.out, {});
});

test('resume and clear warn like startup, so a fresh conversation is told once', () => {
  const { dir } = host();
  const env = envWith({ MATTPOCOCK_SKILLS_ROOT: fakeUpstream({ version: '1.9.0' }).root });
  for (const source of ['resume', 'clear']) assert.ok(start(dir, env, source).out.systemMessage, source);
});

test('the registry path works end to end: a user-scope entry at another version warns', () => {
  const { dir } = host();
  const config = fakeConfigDir([{ scope: 'user', installPath: fakeUpstream({ version: '2.0.0' }).root, version: '2.0.0' }]);
  const r = start(dir, envWith({ CLAUDE_CONFIG_DIR: config }));
  assert.match(r.out.systemMessage, /2\.0\.0/);
});
