// Slots resolved by a lead for a member without Bash (docs/efforts/roster-as-code/spec.md, "The slot
// rule"): the spec skill resolves `spec-writer.codebase-design` and `policy` in step 1 and passes both
// to the spec-writer as pointer lines; the spec-writer calls the codebase-design skill its prompt
// names or skips it on `disabled`; slice-review resolves `policy` for the reviewer's Bugs and
// security prompt. Neither skill reads forge.md's `## Policy skills` itself any more: the roster
// command's fallback does. The commands are run as the skills write them, over fixture hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { forgeMd, host } from './support/host.mjs';
import { stepOf } from './support/skill.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const read = (rel) => readFileSync(path.join(plugin, rel), 'utf8');

const SPEC = read('skills/spec/SKILL.md');
const REVIEW = read('skills/slice-review/SKILL.md');
const WRITER = read('agents/spec-writer.md');

/** The roster commands of `text` that resolve `slot`: each `node "${CLAUDE_PLUGIN_ROOT}/bin/roster.mjs" <slot> --project <p>`. */
const commandsFor = (text, slot) =>
  [...text.matchAll(/`node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/roster\.mjs" ([\w.-]+) --project ([^`]+)`/g)]
    .filter((m) => m[1] === slot)
    .map((m) => ({ slot: m[1], project: m[2] }));

/** Run a roster command as written, from `cwd`, with `<project dir>` standing for `dir`. */
function run({ slot, project }, dir) {
  const target = project === '.' ? '.' : project.replace('<project dir>', dir);
  const r = spawnSync(process.execPath, [path.join(plugin, 'bin', 'roster.mjs'), slot, '--project', target], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

/** A fixture host with this forge.md tail and, when given, this forge.yaml. */
function fixture({ tail = '', yaml } = {}) {
  const { dir } = host({ config: `${forgeMd()}${tail}` });
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  return dir;
}

const ROSTER_YAML = ['version: 1', 'slots:', '  spec-writer.codebase-design: disabled', '  policy: [writing-for-agents, my-plugin:security]', ''].join('\n');
const POLICY_MD = '\n## Policy skills\n- skills: legacy-policy\n';

/* The spec skill */

test('spec step 1: resolves the codebase-design slot and policy through the roster command, naming the default and the rule', () => {
  const step1 = stepOf(SPEC, 1);
  for (const slot of ['spec-writer.codebase-design', 'policy']) {
    assert.equal(commandsFor(step1, slot).length, 1, `one roster command for ${slot} in step 1`);
  }
  assert.ok(step1.includes('`mattpocock-skills:codebase-design`'), 'names the default skill');
  assert.ok(step1.includes('](../build/ROLES.md#slots)'), 'points at the slot rule');
  assert.match(step1, /Done when [^\n]*codebase-design/, 'the step holds the slot before it is done');
});

test('spec step 1: the policy skills come from the roster, not from reading the ## Policy skills bullets alone', () => {
  const step1 = stepOf(SPEC, 1);
  assert.doesNotMatch(step1, /Read the `## Policy skills` bullets/);
  assert.match(step1, /fallback[^\n]*`## Policy skills`/, 'says the command falls back to the deprecated section');
});

test('spec step 2: the prompt carries the codebase-design slot line beside the policy skills', () => {
  const pointers = stepOf(SPEC, 2).split('\n').filter((l) => l.startsWith('- '));
  const slot = pointers.findIndex((l) => l.includes('`spec-writer.codebase-design`') && l.includes('`disabled`'));
  const policy = pointers.findIndex((l) => /policy skills/.test(l) && l.includes('`none`'));
  assert.ok(slot >= 0, 'a pointer line for the codebase-design slot, or disabled');
  assert.ok(policy >= 0, 'a pointer line for the policy skills, or none');
  assert.equal(Math.abs(slot - policy), 1, 'the two lines sit side by side');
});

test('spec: the commands as written print the roster\'s slot and policy, from the host checkout', () => {
  const dir = fixture({ tail: POLICY_MD, yaml: ROSTER_YAML });
  const [design] = commandsFor(SPEC, 'spec-writer.codebase-design');
  const [policy] = commandsFor(SPEC, 'policy');
  assert.equal(run(design, dir), 'disabled');
  assert.equal(run(policy, dir), 'writing-for-agents,my-plugin:security', 'slots.policy replaces ## Policy skills whole');
});

test('spec: without forge.yaml the commands print the default skill and fall back to ## Policy skills', () => {
  const dir = fixture({ tail: POLICY_MD });
  assert.equal(run(commandsFor(SPEC, 'spec-writer.codebase-design')[0], dir), 'mattpocock-skills:codebase-design');
  assert.equal(run(commandsFor(SPEC, 'policy')[0], dir), 'legacy-policy');
  assert.equal(run(commandsFor(SPEC, 'policy')[0], fixture()), 'none');
});

/* The spec-writer */

test('spec-writer: its prompt list names the codebase-design slot line', () => {
  const line = WRITER.split('\n').find((l) => l.startsWith('Your prompt gives'));
  assert.ok(line);
  assert.match(line, /`spec-writer\.codebase-design`[^\n]*`disabled`/);
  assert.match(line, /policy skills/, 'keeps the policy skills');
});

test('spec-writer step 3: calls the skill the slot line names, or skips the call on disabled', () => {
  const step3 = WRITER.split('\n').find((l) => l.startsWith('3. '));
  assert.ok(step3);
  assert.match(step3, /`spec-writer\.codebase-design`/);
  assert.match(step3, /skip[^\n]*`disabled`/i);
  assert.match(step3, /default `mattpocock-skills:codebase-design`/, 'names the default, so the text tests keep holding');
  assert.doesNotMatch(step3, /call `mattpocock-skills:codebase-design` through the Skill tool/, 'no unconditional call of the default');
  assert.match(step3, /Done when /, 'a skipped call keeps its own completion criterion');
});

/* slice-review */

test('slice-review step 1: resolves policy through the roster command for the reviewer', () => {
  const step1 = stepOf(REVIEW, 1);
  const [cmd] = commandsFor(step1, 'policy');
  assert.ok(cmd, 'a roster command for policy in step 1');
  assert.equal(cmd.project, '<project dir>', 'resolved against the host, as the worktree line is');
  assert.ok(step1.includes('](../build/ROLES.md#slots)'), 'points at the slot rule');
  assert.doesNotMatch(step1, /the `## Policy skills` bullets of `docs\/agents\/forge\.md`/);
  assert.match(step1, /fallback[^\n]*`## Policy skills`/);
  assert.match(step1, /Done when [^\n]*policy skills/);
});

test('slice-review step 2: the Bugs and security prompt carries the policy skills resolved in step 1', () => {
  const line = stepOf(REVIEW, 2).split('\n').find((l) => l.startsWith('- Bugs and security:'));
  assert.ok(line);
  assert.match(line, /policy skills[^\n]*step 1/);
  assert.ok(line.includes('`none`'));
});

test('slice-review: the command as written prints the roster\'s policy, and the deprecated section without forge.yaml', () => {
  const [cmd] = commandsFor(REVIEW, 'policy');
  assert.equal(run(cmd, fixture({ tail: POLICY_MD, yaml: ROSTER_YAML })), 'writing-for-agents,my-plugin:security');
  assert.equal(run(cmd, fixture({ tail: POLICY_MD })), 'legacy-policy');
});
