// claude-statusline-clear.sh runs the user's statusLine.command with `clear`,
// stdin handed on, and only when that command is a claude-statusline script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const script = join(root, 'hooks/scripts/claude-statusline-clear.sh');

function run(settings, input = '{"session_id":"s1"}') {
  const home = mkdtempSync(join(tmpdir(), 'workbench-clear-'));
  const settingsFile = join(home, 'settings.json');
  const log = join(home, 'calls.log');
  const fake = join(home, 'claude-statusline.sh');
  writeFileSync(fake, `#!/bin/bash\nprintf '%s|' "$@" >> "${log}"; cat >> "${log}"; echo noise\n`);
  chmodSync(fake, 0o755);
  const other = join(home, 'ccstatusline.sh');
  writeFileSync(other, `#!/bin/bash\necho other >> "${log}"\n`);
  chmodSync(other, 0o755);
  writeFileSync(settingsFile, JSON.stringify(settings({ fake, other })));
  const res = spawnSync('/bin/bash', [script], {
    input,
    env: { HOME: home, PATH: '/usr/bin:/bin:/opt/homebrew/bin', CLAUDE_SETTINGS_FILE: settingsFile },
    encoding: 'utf8',
    timeout: 5000,
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8') : '';
  rmSync(home, { recursive: true, force: true });
  return { ...res, calls };
}

test('runs the wired claude-statusline script with clear and hands stdin on', () => {
  const r = run(({ fake }) => ({ statusLine: { type: 'command', command: fake } }));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'the hook itself prints nothing');
  assert.equal(r.calls, 'clear|{"session_id":"s1"}');
});

test('leaves a status line tool with another name alone', () => {
  const r = run(({ other }) => ({ statusLine: { type: 'command', command: other } }));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.calls, '');
});

test('no statusLine wired: silent, exit 0', () => {
  const r = run(() => ({}));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.calls, '');
});
