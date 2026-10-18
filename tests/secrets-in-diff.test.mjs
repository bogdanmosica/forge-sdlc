// The secrets-in-diff guardrail: a commit that would add a credential shape is denied, naming
// the path and the pattern, never the value. "Would add" covers what is staged and what the same
// command stages first (`git add … &&`, `commit -a`, `commit <path>`). Every fixture value is built from repeated
// filler so no realistic credential sits in this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { bash, decisionOf, hook, host, reasonOf } from './support/host.mjs';

const HOOK = 'secrets-in-diff.mjs';
const fill = (n, c = 'X') => c.repeat(n);

/** Write `files` ({ rel: text }) in `dir` without staging them. */
function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
}

/** Write and stage `files` in `dir`. */
function stage(dir, files) {
  write(dir, files);
  const r = spawnSync('git', ['-C', dir, 'add', '-A'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

/** What is really staged in `dir`, to prove the hook never touches the index. */
const stagedNames = (dir) =>
  spawnSync('git', ['-C', dir, 'diff', '--cached', '--name-only'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);

/** Commit `files` quietly, so they are tracked and clean. */
function committed(dir, files) {
  stage(dir, files);
  const r = spawnSync('git', ['-C', dir, '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', 'base'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

const commit = (dir, command = 'git commit -m wip') => hook(HOOK, bash(dir, command));

const SHAPES = {
  'AWS access key id': `const id = "AKIA${fill(16)}";\n`,
  'AWS secret access key': `aws_secret_access_key = ${fill(40, 'x')}\n`,
  'OpenAI key': `OPENAI=sk-${fill(32, 'x')}\n`,
  'OpenAI project key': `key: sk-proj-${fill(32, 'x')}\n`,
  'Anthropic key': `key: sk-ant-${fill(32, 'x')}\n`,
  'Google API key': `k = "AIza${fill(35, 'x')}"\n`,
  'Google OAuth token': `t = "ya29.${fill(30, 'x')}"\n`,
  'Bearer token': `headers: { Authorization: "Bearer ${fill(30, 'x')}" }\n`,
  private_key: `{ "private_key": "${fill(8)}" }\n`,
  'Azure AccountKey': `conn = "DefaultEndpointsProtocol=https;AccountName=a;AccountKey=${fill(40, 'x')}"\n`,
  'credentials in a URL': `DATABASE_URL=postgres://app:${fill(12, 'x')}@db.internal:5432/app\n`,
};

for (const [name, text] of Object.entries(SHAPES)) {
  test(`a staged ${name} is denied; the reason names the path and the pattern, never the value`, () => {
    const { dir } = host({ branch: 'feat/x' });
    stage(dir, { 'src/config.ts': text });
    const r = commit(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(decisionOf(r), 'deny');
    assert.match(reasonOf(r), /src\/config\.ts/);
    assert.ok(reasonOf(r).includes(name), reasonOf(r));
    for (const word of text.match(/[A-Za-z0-9._-]{12,}/g) ?? []) {
      assert.ok(!reasonOf(r).includes(word), `the reason quotes ${word}`);
    }
  });
}

test('an added .env or .env.* file is denied by name, whatever it holds', () => {
  for (const rel of ['.env', 'apps/web/.env.local']) {
    const { dir } = host({ branch: 'feat/x' });
    stage(dir, { [rel]: 'PORT=3000\n' });
    const r = commit(dir);
    assert.equal(decisionOf(r), 'deny', rel);
    assert.ok(reasonOf(r).includes(rel), reasonOf(r));
  }
});

test('every hit is listed; the reason says what to do instead', () => {
  const { dir } = host({ branch: 'feat/x' });
  stage(dir, { 'a.ts': SHAPES['OpenAI key'], 'b/c.py': SHAPES['Bearer token'] });
  const reason = reasonOf(commit(dir));
  assert.match(reason, /a\.ts/);
  assert.match(reason, /b\/c\.py/);
  assert.match(reason, /environment variable|secrets manager/i);
  assert.match(reason, /rotate/i);
});

test('a removed credential line is not a hit: only added lines are scanned', () => {
  const { dir } = host({ branch: 'feat/x' });
  stage(dir, { 'src/config.ts': SHAPES['OpenAI key'] });
  spawnSync('git', ['-C', dir, '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '-m', 'old'], { encoding: 'utf8' });
  stage(dir, { 'src/config.ts': 'OPENAI=process.env.OPENAI_API_KEY\n' });
  assert.deepEqual(commit(dir).decision, {});
});

test('a clean staged diff, nothing staged, or placeholders: quiet', () => {
  const { dir } = host({ branch: 'feat/x' });
  assert.deepEqual(commit(dir).decision, {});
  stage(dir, { 'src/a.ts': 'const key = process.env.API_KEY; // <YOUR_API_KEY>\nconst url = "https://example.com/a@b";\n' });
  assert.deepEqual(commit(dir).decision, {});
});

test('git -C <dir> commit scans the staged diff of that checkout', () => {
  const { dir } = host({ branch: 'feat/x' });
  const other = host({ branch: 'feat/x' }).dir;
  stage(other, { 'src/config.ts': SHAPES['Anthropic key'] });
  const r = hook(HOOK, bash(dir, `git -C ${other} commit -m wip`));
  assert.equal(decisionOf(r), 'deny');
  assert.deepEqual(commit(dir).decision, {});
});

test('commands that are not commits, and a commit outside a repo, are quiet', () => {
  const { dir } = host({ branch: 'feat/x' });
  stage(dir, { 'src/config.ts': SHAPES['OpenAI key'] });
  assert.deepEqual(hook(HOOK, bash(dir, 'git status')).decision, {});
  assert.deepEqual(hook(HOOK, bash(dir, 'git diff --cached')).decision, {});
  const outside = mkdtempSync(path.join(tmpdir(), 'forge-norepo-'));
  const r = hook(HOOK, bash(outside, 'git commit -m wip'));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
});

test('chained forms are caught: git add -A && git commit, with the file already staged', () => {
  const { dir } = host({ branch: 'feat/x' });
  stage(dir, { 'src/config.ts': SHAPES['Google API key'] });
  assert.equal(decisionOf(commit(dir, 'git add -A && git commit -m wip')), 'deny');
});

/* What the command itself stages, before the commit runs. */

test('git add <path> && git commit: an unstaged file the command adds is scanned, and the real index stays untouched', () => {
  const { dir } = host({ branch: 'feat/x' });
  write(dir, { 'src/config.ts': SHAPES['OpenAI key'] });
  assert.deepEqual(stagedNames(dir), []);
  for (const command of [
    'git add src/config.ts && git commit -m wip',
    'git add . && git commit -m "add config"',
    'git add -A; git commit -m wip',
    'git add --all && git commit -q -m wip',
  ]) {
    const r = commit(dir, command);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(decisionOf(r), 'deny', command);
    assert.match(reasonOf(r), /src\/config\.ts: OpenAI key/);
    assert.deepEqual(stagedNames(dir), [], `${command} staged something for real`);
  }
});

test('git add of a clean path, with the secret in a path the command does not add: quiet', () => {
  const { dir } = host({ branch: 'feat/x' });
  write(dir, { 'src/config.ts': SHAPES['Anthropic key'], 'docs/a.md': '# fine\n' });
  assert.deepEqual(commit(dir, 'git add docs/a.md && git commit -m docs').decision, {});
  assert.equal(decisionOf(commit(dir, 'git add src && git commit -m wip')), 'deny');
});

test('git commit -a and -am: a tracked file modified in place is scanned; an untracked file is not, since -a never stages it', () => {
  const { dir } = host({ branch: 'feat/x' });
  committed(dir, { 'src/config.ts': 'OPENAI=process.env.OPENAI_API_KEY\n' });
  write(dir, { 'src/config.ts': SHAPES['OpenAI key'], 'src/new.ts': SHAPES['Bearer token'] });
  for (const command of ['git commit -a -m wip', 'git commit -am wip', 'git commit --all -m wip', 'git commit -qam "wip: all"']) {
    const r = commit(dir, command);
    assert.equal(decisionOf(r), 'deny', command);
    assert.match(reasonOf(r), /src\/config\.ts: OpenAI key/);
    assert.doesNotMatch(reasonOf(r), /src\/new\.ts/, `${command}: -a does not stage untracked files`);
    assert.deepEqual(stagedNames(dir), []);
  }
  assert.deepEqual(commit(dir, 'git commit -m wip').decision, {}, 'without -a nothing is staged, so nothing is scanned');
});

test('git commit <pathspec>: only the named paths are scanned', () => {
  const { dir } = host({ branch: 'feat/x' });
  committed(dir, { 'src/config.ts': 'a\n', 'src/other.ts': 'b\n' });
  write(dir, { 'src/config.ts': SHAPES['Google OAuth token'], 'src/other.ts': SHAPES['Azure AccountKey'] });
  const named = commit(dir, 'git commit -m wip -- src/config.ts');
  assert.equal(decisionOf(named), 'deny');
  assert.match(reasonOf(named), /src\/config\.ts/);
  assert.doesNotMatch(reasonOf(named), /src\/other\.ts/);
  assert.equal(decisionOf(commit(dir, 'git commit src/other.ts -m wip')), 'deny');
  assert.deepEqual(commit(dir, 'git commit -m "update src/config.ts" -- README.md').decision, {}, 'a path inside the message is not a pathspec');
  assert.deepEqual(stagedNames(dir), []);
});

test('an unstaged .env added by the command is denied by name', () => {
  const { dir } = host({ branch: 'feat/x' });
  write(dir, { 'apps/web/.env': 'PORT=3000\n' });
  const r = commit(dir, 'git add apps/web && git commit -m env');
  assert.equal(decisionOf(r), 'deny');
  assert.match(reasonOf(r), /apps\/web\/\.env: \.env file/);
});

test('cd and -C move the add and the commit to that checkout', () => {
  const { dir } = host({ branch: 'feat/x' });
  write(dir, { 'src/config.ts': SHAPES['AWS access key id'] });
  assert.equal(decisionOf(commit(dir, `cd ${dir}/src && git add config.ts && git commit -m wip`)), 'deny');
  const elsewhere = mkdtempSync(path.join(tmpdir(), 'forge-elsewhere-'));
  assert.equal(decisionOf(hook(HOOK, bash(elsewhere, `git -C ${dir} add -A && git -C ${dir} commit -m wip`))), 'deny');
  const other = host({ branch: 'feat/x' }).dir;
  assert.deepEqual(hook(HOOK, bash(other, `git -C ${dir} add -A && git commit -m wip`)).decision, {}, 'the add was in another repo');
});

test('interactive and dry-run adds are not simulated, so they stage nothing for the scan', () => {
  const { dir } = host({ branch: 'feat/x' });
  write(dir, { 'src/config.ts': SHAPES['OpenAI key'] });
  for (const command of ['git add -p src && git commit -m wip', 'git add -n . && git commit -m wip']) {
    assert.deepEqual(commit(dir, command).decision, {}, command);
  }
});

test('the real index is identical after the hook ran', () => {
  const { dir } = host({ branch: 'feat/x' });
  stage(dir, { 'docs/a.md': '# a\n' });
  write(dir, { 'src/config.ts': SHAPES['OpenAI key'] });
  const before = readFileSync(path.join(dir, '.git', 'index'));
  assert.equal(decisionOf(commit(dir, 'git add src && git commit -m wip')), 'deny');
  assert.ok(before.equals(readFileSync(path.join(dir, '.git', 'index'))));
  assert.deepEqual(stagedNames(dir), ['docs/a.md']);
});
