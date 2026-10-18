// The upstream seam: resolution through the override and the registry, the skill-path CLI, the
// lock, and the verdict the hook and --check share.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkUpstream, installedUpstream, parseLock, readLock, skillFile, warningFor } from '../plugins/forge-sdlc/bin/upstream.mjs';
import { envWith, fakeConfigDir, fakeUpstream, lockText, plugin } from './support/upstream.mjs';

const cli = (args, env, cwd = plugin) =>
  spawnSync(process.execPath, [path.join(plugin, 'bin', 'skill-path.mjs'), ...args], { encoding: 'utf8', env, cwd });

test('the lock parses: version, date, and the headings per skill', () => {
  const lock = readLock();
  assert.match(lock.version, /^\d+\.\d+\.\d+$/);
  assert.match(lock.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(lock.skills['to-spec'].includes('## Problem Statement'));
  assert.ok(lock.skills.wayfinder.includes('### Work through the map'));
  assert.deepEqual(parseLock('# c\nversion: 2.0.0\nx: ## A | ## B\n').skills, { x: ['## A', '## B'] });
});

test('MATTPOCOCK_SKILLS_ROOT resolves a plugin root directly and reads its manifest version', () => {
  const { root } = fakeUpstream({ version: '9.9.9' });
  const found = installedUpstream({ env: { MATTPOCOCK_SKILLS_ROOT: root } });
  assert.deepEqual(found, { root, version: '9.9.9', scope: 'override' });
  assert.equal(installedUpstream({ env: { MATTPOCOCK_SKILLS_ROOT: '/nowhere/at/all' } }), null);
});

test('the registry resolves the project entry for this project, else the user entry, else any', () => {
  const a = fakeUpstream({ version: '1.0.0' });
  const b = fakeUpstream({ version: '2.0.0' });
  const c = fakeUpstream({ version: '3.0.0' });
  const here = mkdtempSync(path.join(tmpdir(), 'forge-proj-'));
  const config = fakeConfigDir([
    { scope: 'project', projectPath: '/some/other/project', installPath: c.root, version: '3.0.0' },
    { scope: 'user', installPath: b.root, version: '2.0.0' },
    { scope: 'project', projectPath: here, installPath: a.root, version: '1.0.0' },
  ]);
  const env = { CLAUDE_CONFIG_DIR: config };
  assert.equal(installedUpstream({ env, projectDir: here }).version, '1.0.0');
  assert.equal(installedUpstream({ env, projectDir: '/elsewhere' }).version, '2.0.0');
  const onlyOther = fakeConfigDir([{ scope: 'project', projectPath: '/x', installPath: c.root, version: '3.0.0' }]);
  assert.equal(installedUpstream({ env: { CLAUDE_CONFIG_DIR: onlyOther }, projectDir: here }).version, '3.0.0');
});

test('an entry whose install path is gone is skipped; an empty or missing registry is not installed', () => {
  const live = fakeUpstream({ version: '1.3.1' });
  const config = fakeConfigDir([
    { scope: 'user', installPath: '/gone/cache/mattpocock-skills/0.0.1', version: '0.0.1' },
    { scope: 'project', projectPath: '/x', installPath: live.root, version: '1.3.1' },
  ]);
  assert.equal(installedUpstream({ env: { CLAUDE_CONFIG_DIR: config }, projectDir: '/y' }).version, '1.3.1');
  assert.equal(installedUpstream({ env: { CLAUDE_CONFIG_DIR: fakeConfigDir([]) } }), null);
  assert.equal(installedUpstream({ env: { CLAUDE_CONFIG_DIR: '/no/such/config' } }), null);
});

test('skillFile finds a skill one level down (engineering, productivity) or directly under skills/', () => {
  const { root } = fakeUpstream({ skills: { tdd: ['## Rules'], grilling: ['## Loop'] } });
  assert.equal(skillFile(root, 'tdd'), path.join(root, 'skills', 'engineering', 'tdd', 'SKILL.md'));
  assert.equal(skillFile(root, 'grilling'), path.join(root, 'skills', 'productivity', 'grilling', 'SKILL.md'));
  assert.equal(skillFile(root, 'nope'), null);
  const flat = fakeUpstream({ skills: {} });
  const direct = path.join(flat.root, 'skills', 'pr');
  mkdirSync(direct, { recursive: true });
  writeFileSync(path.join(direct, 'SKILL.md'), '## Sections\n');
  assert.equal(skillFile(flat.root, 'pr'), path.join(direct, 'SKILL.md'));
});

test('skill-path CLI prints the file, --root the root, exits 1 when not installed and 2 for an unknown skill', () => {
  const { root } = fakeUpstream();
  const env = envWith({ MATTPOCOCK_SKILLS_ROOT: root });
  const found = cli(['to-spec'], env);
  assert.equal(found.status, 0, found.stderr);
  assert.equal(found.stdout.trim(), path.join(root, 'skills', 'engineering', 'to-spec', 'SKILL.md'));
  assert.equal(cli(['--root'], env).stdout.trim(), root);
  const unknown = cli(['no-such-skill'], env);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /no skill "no-such-skill"/);
  const missing = cli(['to-spec'], envWith());
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /claude plugin install mattpocock-skills@claude-plugins-official/);
  assert.equal(cli([], env).status, 1);
});

test('checkUpstream: ok at the locked version with every heading; drift on another version; broken on a lost heading or file', () => {
  const lock = readLock();
  const ok = checkUpstream({ env: { MATTPOCOCK_SKILLS_ROOT: fakeUpstream({ version: lock.version }).root } });
  assert.equal(ok.status, 'ok');
  assert.equal(warningFor(ok), null);

  const drift = checkUpstream({ env: { MATTPOCOCK_SKILLS_ROOT: fakeUpstream({ version: '1.4.0' }).root } });
  assert.equal(drift.status, 'drift');
  assert.match(warningFor(drift), /1\.4\.0/);
  assert.match(warningFor(drift), new RegExp(lock.version.replace(/\./g, '\\.')));
  assert.match(warningFor(drift), /bump UPSTREAM\.lock/);

  const lostHeading = fakeUpstream({ version: lock.version, drop: { skill: 'to-spec', heading: '## User Stories' } });
  const broken = checkUpstream({ env: { MATTPOCOCK_SKILLS_ROOT: lostHeading.root } });
  assert.equal(broken.status, 'broken');
  assert.deepEqual(broken.missing, [{ skill: 'to-spec', heading: '## User Stories' }]);
  assert.match(warningFor(broken), /to-spec: "## User Stories"/);

  const lostFile = fakeUpstream({ version: '1.4.0', drop: { skill: 'wayfinder' } });
  const gone = checkUpstream({ env: { MATTPOCOCK_SKILLS_ROOT: lostFile.root } });
  assert.equal(gone.status, 'broken', 'a lost file outranks drift');
  assert.deepEqual(gone.missing, [{ skill: 'wayfinder', heading: null }]);

  const none = checkUpstream({ env: { CLAUDE_CONFIG_DIR: fakeConfigDir([]) } });
  assert.equal(none.status, 'missing');
  assert.match(warningFor(none), /not installed/);
});

test('--check prints the verdict as JSON and exits 1 unless ok', () => {
  const lock = readLock();
  const ok = cli(['--check'], envWith({ MATTPOCOCK_SKILLS_ROOT: fakeUpstream({ version: lock.version }).root }));
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).status, 'ok');
  const drift = cli(['--check'], envWith({ MATTPOCOCK_SKILLS_ROOT: fakeUpstream({ version: '0.1.0' }).root }));
  assert.equal(drift.status, 1);
  assert.equal(JSON.parse(drift.stdout).status, 'drift');
});

const vendored = process.env.MATTPOCOCK_VENDORED_ROOT ?? '';
test(
  'every locked heading exists in the vendored v1.3.1 copy on this machine',
  { skip: !existsSync(vendored) && 'no vendored copy here' },
  () => {
    const verdict = checkUpstream({ env: { MATTPOCOCK_SKILLS_ROOT: vendored } });
    assert.deepEqual(verdict.missing, [], JSON.stringify(verdict.missing));
    assert.equal(parseLock(lockText()).version, verdict.installed);
  },
);
