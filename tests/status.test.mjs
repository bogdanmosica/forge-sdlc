// The status skill (design section 5, the status row; section 9), tested for structure:
// frontmatter, effort-state.mjs for one or all efforts, frontier, red slices, worktrees, read-only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const skill = readFileSync(path.join(plugin, 'skills', 'status', 'SKILL.md'), 'utf8');
const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skill)?.[1] ?? '';

test('frontmatter: name, description, user-invoked, optional slug', () => {
  assert.match(frontmatter, /^name: status$/m);
  assert.match(frontmatter, /^description: .{20,}$/m);
  assert.match(frontmatter, /^disable-model-invocation: true$/m);
  assert.match(frontmatter, /^argument-hint: "\[slug\]"$/m);
});

test('every numbered step ends on a Done when line', () => {
  const steps = skill.split(/^## \d+\. /m).slice(1);
  assert.equal(steps.length, 3);
  for (const step of steps) assert.match(step, /Done when [^\n]+\.\s*$/, step.split('\n')[0]);
});

test('runs effort-state.mjs for the slug or --list, and the script exists', () => {
  assert.match(skill, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/effort-state\.mjs" \. <slug>/);
  assert.match(skill, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/effort-state\.mjs" --list \./);
  assert.ok(existsSync(path.join(plugin, 'bin', 'effort-state.mjs')));
});

test('prints stage, gate, frontier from the tracker doc, red slices from state, worktrees', () => {
  for (const word of ['stage', 'gate', 'frontier', 'red', 'worktrees']) assert.match(skill, new RegExp(word), word);
  assert.match(skill, /docs\/agents\/issue-tracker\.md/);
  assert.match(skill, /blockers are all closed/);
  assert.match(skill, /\.forge\/state\.json/);
  assert.match(skill, /status: red/);
  assert.match(skill, /\.forge\/worktrees\//);
  assert.match(skill, /git worktree list/);
  assert.match(skill, /\/forge-sdlc:wayfinder <slug>/);
});

test('read-only: names no write', () => {
  assert.match(skill, /read-only/i);
  assert.doesNotMatch(skill, /writeState|git commit|git push|gh (issue|pr) (create|edit|close)|gh pr ready/);
});

test('under one screen', () => {
  assert.ok(skill.split('\n').length < 50);
});

test('prints the policy on each effort first line and the stop when set', () => {
  assert.match(skill, /`policy`/);
  assert.match(skill, /`stop`/);
  const first = /```text\n([^\n]+)\n/.exec(skill)?.[1] ?? '';
  assert.match(first, /policy <policy>/);
  assert.match(skill, /stopped: <stop>/);
  assert.match(skill, /stop[^\n]*none/);
});
