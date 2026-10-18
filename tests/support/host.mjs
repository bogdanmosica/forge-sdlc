// A fixture host: a git repo in a temp dir on a given branch, with or without docs/agents/forge.md,
// and the helpers that spawn a hook script the way the engine does (payload on stdin,
// CLAUDE_PROJECT_DIR set) and parse the decision it wrote.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugins', 'forge-sdlc', 'hooks', 'scripts');

/** A forge.md with a Branches section; `lines` are extra bullets under it. */
export const forgeMd = (lines = []) =>
  ['# forge-sdlc host config', '', '## Branches', '- default: main', ...lines, '', '## Gates', '- spec: always', ''].join('\n');

const sh = (dir, args) => {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};

/**
 * `{ dir }`: a repo whose first branch is `initial` (main by default) with one commit, checked
 * out on `branch` (created when it is not `initial`). `config` is the forge.md text to write,
 * null for a host that has not run init. Extra `branches` and `tags` are created locally, not checked out.
 */
export function host({ branch = 'main', initial = 'main', config = forgeMd(), branches = [], tags = [] } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'forge-host-'));
  sh(dir, ['init', '-q', '-b', initial]);
  sh(dir, ['config', 'user.email', 'test@example.invalid']);
  sh(dir, ['config', 'user.name', 'test']);
  sh(dir, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(path.join(dir, 'README.md'), '# host\n');
  if (config !== null) {
    mkdirSync(path.join(dir, 'docs', 'agents'), { recursive: true });
    writeFileSync(path.join(dir, 'docs', 'agents', 'forge.md'), config);
  }
  sh(dir, ['add', '-A']);
  sh(dir, ['commit', '-q', '-m', 'init']);
  for (const name of branches) sh(dir, ['branch', name]);
  for (const name of tags) sh(dir, ['tag', name]);
  if (branch !== initial) sh(dir, ['switch', '-q', '-c', branch]);
  return { dir };
}

/** Spawn a hook script with `payload` on stdin; `{ status, stderr, decision }`. */
export function hook(script, payload, { projectDir = payload.cwd } = {}) {
  const r = spawnSync(process.execPath, [path.join(scripts, script)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
  let decision = null;
  try {
    decision = JSON.parse(r.stdout);
  } catch {
    decision = { unparsable: r.stdout };
  }
  return { status: r.status, stderr: r.stderr, decision };
}

export const edit = (dir, rel = 'src/App.ts') => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Edit',
  tool_input: { file_path: path.join(dir, rel), old_string: 'a', new_string: 'b' },
  cwd: dir,
});

export const bash = (dir, command) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command },
  cwd: dir,
});

export const decisionOf = (r) => r.decision.hookSpecificOutput?.permissionDecision ?? 'allow';
export const reasonOf = (r) => r.decision.hookSpecificOutput?.permissionDecisionReason ?? '';
