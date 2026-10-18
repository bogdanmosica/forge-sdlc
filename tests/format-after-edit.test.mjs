// The format-after-edit hook: PostToolUse on Edit and Write runs the host's formatter on the
// edited file and always answers {}. A failed formatter is one stderr line, never a decision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { hook, host } from './support/host.mjs';

const HOOK = 'format-after-edit.mjs';
const config = (command) => ['# forge-sdlc host config', '', '## Branches', '- default: main', '', '## Formatter', `- command: ${command}`, ''].join('\n');

/** A host whose formatter is `command`, with `src/a b.ts` written; `{ dir, file }`. */
function fixture(command) {
  const { dir } = host({ branch: 'feat/x', config: command === null ? null : config(command) });
  const file = path.join(dir, 'src', 'a b.ts');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, 'x\n');
  return { dir, file };
}

const post = (dir, file, tool = 'Edit') =>
  hook(HOOK, { hook_event_name: 'PostToolUse', tool_name: tool, tool_input: { file_path: file }, tool_response: {}, cwd: dir });

test('<file> is replaced by the edited path, quoted, and the formatter runs; the answer is {}', () => {
  const { dir, file } = fixture('`node -e "require(\'fs\').appendFileSync(process.argv[1], \'formatted\\n\')" <file>`');
  for (const tool of ['Edit', 'Write']) {
    const r = post(dir, file, tool);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.decision, {});
  }
  assert.equal(readFileSync(file, 'utf8'), 'x\nformatted\nformatted\n');
});

test('without <file>, the path is appended', () => {
  const { dir, file } = fixture('node -e "require(\'fs\').appendFileSync(process.argv[1], \'tail\\n\')"');
  assert.deepEqual(post(dir, file).decision, {});
  assert.equal(readFileSync(file, 'utf8'), 'x\ntail\n');
});

test('the formatter runs in the edited file\'s checkout', () => {
  const { dir, file } = fixture('node -e "require(\'fs\').writeFileSync(\'ran-here\', \'\')"');
  post(dir, file);
  assert.ok(existsSync(path.join(dir, 'ran-here')));
});

test('a failing formatter writes one line to stderr and still answers {} with exit 0', () => {
  const { dir, file } = fixture('node -e "process.exit(3)"');
  const r = post(dir, file);
  assert.equal(r.status, 0);
  assert.deepEqual(r.decision, {});
  assert.equal(r.stderr.trim().split('\n').length, 1);
  assert.match(r.stderr, /formatter/i);
});

test('formatter output never reaches stdout: the decision stays parseable', () => {
  const { dir, file } = fixture('node -e "console.log(\'noise\')"');
  assert.deepEqual(post(dir, file).decision, {});
});

test('none, no formatter line, no config, other tools, a missing file: nothing runs, {}', () => {
  for (const command of ['none', null]) {
    const { dir, file } = fixture(command);
    assert.deepEqual(post(dir, file).decision, {});
    assert.equal(readFileSync(file, 'utf8'), 'x\n');
  }
  const { dir, file } = fixture('node -e "require(\'fs\').writeFileSync(\'ran-here\', \'\')"');
  assert.deepEqual(post(dir, file, 'Read').decision, {});
  assert.deepEqual(post(dir, path.join(dir, 'gone.ts')).decision, {});
  assert.ok(!existsSync(path.join(dir, 'ran-here')));
});
