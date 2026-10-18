// bin/verify-record.mjs: runs the proof and the host's proof commands in a slice worktree and
// writes .forge/verify/<slice>.json (docs/contracts.md, "verify record"). Fixture hosts whose
// proof commands are tiny shell commands, so no real toolchain is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { forgeMd, host } from './support/host.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'bin', 'verify-record.mjs');

/** A forge.md with the Branches section and these proof commands. */
const withProof = (proof) => `${forgeMd()}\n## Proof commands\n${Object.entries(proof).map(([k, v]) => `- ${k}: \`${v}\``).join('\n')}\n`;

/** A host with `proof` commands and a slice worktree for demo-01; `{ dir, worktree }`. */
function sliceHost(proof) {
  const { dir } = host({ config: withProof(proof) });
  const worktree = path.join(dir, '.forge', 'worktrees', 'demo-01');
  const r = spawnSync('git', ['-C', dir, 'worktree', 'add', '-q', '-b', 'slice/demo-01', worktree], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { dir, worktree };
}

const verify = (args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const recordOf = (dir) => JSON.parse(readFileSync(path.join(dir, '.forge', 'verify', 'demo-01.json'), 'utf8'));
const headOf = (dir) => spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

test('all green: proof first, then the host commands in config order, none skipped; exit 0', () => {
  const { dir, worktree } = sliceHost({ build: 'true', test: 'true', typecheck: 'none', lint: 'echo linted' });
  const r = verify(['--slice', 'demo-01', '--worktree', worktree, '--project', dir, '--proof', 'echo proved']);
  assert.equal(r.status, 0, r.stderr);
  const record = recordOf(dir);
  assert.deepEqual(JSON.parse(r.stdout), record, 'prints the record it wrote');
  assert.equal(record.slice, 'demo-01');
  assert.equal(record.head, headOf(worktree));
  assert.match(record.head, /^[0-9a-f]{40}$/);
  assert.ok(!Number.isNaN(Date.parse(record.at)));
  assert.equal(record.green, true);
  assert.deepEqual(record.runs.map((x) => x.name), ['proof', 'test', 'lint', 'build']);
  assert.deepEqual(record.runs[0], { ...record.runs[0], command: 'echo proved', exitCode: 0, tail: 'proved' });
  assert.equal(record.runs[2].tail, 'linted');
  for (const run of record.runs) assert.equal(typeof run.ms, 'number');
});

test('a failing command makes the record red, every command still runs, exit 1', () => {
  const { dir, worktree } = sliceHost({ test: 'false', typecheck: 'true' });
  const r = verify(['--slice', 'demo-01', '--worktree', worktree, '--project', dir, '--proof', 'true']);
  assert.equal(r.status, 1);
  const record = recordOf(dir);
  assert.equal(record.green, false);
  assert.deepEqual(record.runs.map((x) => [x.name, x.exitCode]), [['proof', 0], ['test', 1], ['typecheck', 0]]);
});

test('without --proof the runs start at the host commands', () => {
  const { dir, worktree } = sliceHost({ test: 'true' });
  const r = verify(['--slice', 'demo-01', '--worktree', worktree, '--project', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(recordOf(dir).runs.map((x) => x.name), ['test']);
});

test('commands run in the worktree, not the project dir', () => {
  const { dir, worktree } = sliceHost({ test: 'test -f only-here.txt' });
  writeFileSync(path.join(worktree, 'only-here.txt'), 'x');
  assert.equal(verify(['--slice', 'demo-01', '--worktree', worktree, '--project', dir]).status, 0);
});

test('tail keeps the last 20 lines, stderr included', () => {
  const { dir, worktree } = sliceHost({ test: 'seq 1 49; echo fifty >&2' });
  verify(['--slice', 'demo-01', '--worktree', worktree, '--project', dir]);
  const lines = recordOf(dir).runs[0].tail.split('\n');
  assert.equal(lines.length, 20);
  assert.equal(lines[0], '31');
  assert.equal(lines.at(-1), 'fifty');
});

test('secret shapes in the output are masked as [REDACTED]', () => {
  const token = `sk-test-${'x'.repeat(24)}`;
  const aws = `AKIA${'X'.repeat(16)}`;
  const { dir, worktree } = sliceHost({ test: 'sh leak.sh' });
  writeFileSync(path.join(worktree, 'leak.sh'), `echo "key=${token}"\necho "id ${aws} ok"\necho "Authorization: Bearer abc.def-ghi_123"\n`);
  const r = verify(['--slice', 'demo-01', '--worktree', worktree, '--project', dir]);
  const tail = recordOf(dir).runs[0].tail;
  for (const secret of [token, aws, 'abc.def-ghi_123']) {
    assert.ok(!tail.includes(secret), 'tail holds no secret');
    assert.ok(!r.stdout.includes(secret), 'stdout holds no secret');
  }
  assert.match(tail, /\[REDACTED\]/);
  assert.match(tail, /id \[REDACTED\] ok/);
});

test('the write is atomic: no temp file is left beside the record', () => {
  const { dir, worktree } = sliceHost({ test: 'true' });
  verify(['--slice', 'demo-01', '--worktree', worktree, '--project', dir]);
  const left = spawnSync('ls', [path.join(dir, '.forge', 'verify')], { encoding: 'utf8' }).stdout.trim();
  assert.equal(left, 'demo-01.json');
});

test('missing arguments: usage on stderr, exit 2, no record', () => {
  const { dir } = sliceHost({ test: 'true' });
  const r = verify(['--slice', 'demo-01', '--project', dir]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--worktree/);
  assert.ok(!existsSync(path.join(dir, '.forge', 'verify', 'demo-01.json')));
});

test('nothing to run (no --proof, every host command none) is red, exit 1: an empty record proves nothing', () => {
  const { dir, worktree } = sliceHost({ test: 'none' });
  const r = verify(['--slice', 'demo-01', '--worktree', worktree, '--project', dir]);
  assert.equal(r.status, 1);
  assert.deepEqual(recordOf(dir).runs, []);
  assert.equal(recordOf(dir).green, false);
});
