// Every hook hooks.json wires, run the way Claude Code runs it, outside cmux: no
// `cmux` on PATH, no CMUX_* environment, an empty HOME. A hook outside cmux must be
// silent and exit 0, since a hook's stdout reaches Claude as context and a failing
// hook shows on every turn of every session that has the plugin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const { hooks } = JSON.parse(readFileSync(join(root, 'hooks/hooks.json'), 'utf8'));

const INPUT = {
  session_id: 'test-session',
  transcript_path: '/nonexistent/transcript.jsonl',
  cwd: root,
  tool_name: 'Edit',
  tool_input: { file_path: join(root, 'README.md') },
  last_assistant_message: 'Done: the hooks moved.',
  agent_type: 'Explore',
  task_id: '1',
  task_subject: 'a task',
  notification_type: 'permission_prompt',
  prompt: 'hello',
};

const runs = Object.entries(hooks).flatMap(([event, groups]) =>
  groups.flatMap((group) => group.hooks.map((hook) => ({ event, hook }))),
);

test('every wired hook runs a script that ships with the plugin', () => {
  assert.ok(runs.length > 0);
  for (const { event, hook } of runs) {
    assert.equal(hook.command, '/bin/bash', `${event} runs under /bin/bash like the shebangs`);
    const script = hook.args[0].replace('${CLAUDE_PLUGIN_ROOT}', root);
    assert.ok(existsSync(script), `${event}: ${script} exists`);
  }
});

test('outside cmux every hook is silent and exits 0', () => {
  const home = mkdtempSync(join(tmpdir(), 'workbench-home-'));
  try {
    for (const { event, hook } of runs) {
      const args = hook.args.map((a) => a.replace('${CLAUDE_PLUGIN_ROOT}', root));
      const { status, stdout } = spawnSync(hook.command, args, {
        input: JSON.stringify({ ...INPUT, hook_event_name: event }),
        env: { HOME: home, PATH: '/usr/bin:/bin', CLAUDE_PLUGIN_ROOT: root },
        encoding: 'utf8',
        timeout: hook.timeout * 1000,
      });
      const label = `${event}: ${hook.args.join(' ')}`;
      assert.equal(status, 0, `${label} exits 0`);
      assert.equal(stdout, '', `${label} prints nothing`);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
