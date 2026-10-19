// The build skill and its two agents, structurally: frontmatter and tool scoping, the
// implement-spec steps under the frame of design section 5, step 7 replaced, no AskUserQuestion,
// the verifier script named with its real flags, linked files present, the upstream procedure
// pointed at rather than pasted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installedUpstream, skillFile } from '../plugins/forge-sdlc/bin/upstream.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(repo, 'plugins', 'forge-sdlc');
const SKILL = 'skills/build/SKILL.md';
const IMPLEMENTER = 'agents/implementer.md';
const MERGER = 'agents/merger.md';
const MEMBERS = 'skills/build/MEMBERS.md';
const read = (rel) => readFileSync(path.join(plugin, rel), 'utf8');

/** `{ fields, body }` of a markdown file with `key: value` frontmatter. */
function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, 'frontmatter block');
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return { fields, body: m[2] };
}

const relativeLinks = (text) =>
  [...text.matchAll(/\[[^\]]*\]\(([^)#\s]+)\)/g)].map((m) => m[1]).filter((t) => !/^[a-z]+:/.test(t));
const toolsOf = (value) => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/* The skill */

test('build: user-invoked, named build, takes a slug', () => {
  const { fields } = frontmatter(read(SKILL));
  assert.equal(fields.name, 'build');
  assert.ok(fields.description?.length >= 20);
  assert.equal(fields['disable-model-invocation'], 'true');
  assert.equal(fields['argument-hint'], '<slug>');
});

test('build: precondition is plan.md committed and the state at gate plan', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /^## .*Precondition/m);
  assert.match(body, /docs\/efforts\/<slug>\/plan\.md/);
  assert.match(body, /gate: plan/);
  assert.match(body, /\/forge-sdlc:plan <slug>/);
});

test('build: implement-spec is resolved by file and followed step by step', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /skill-path\.mjs" implement-spec/);
  for (let n = 1; n <= 9; n++) assert.match(body, new RegExp(`[Ss]tep ${n}\\b`), `names implement-spec step ${n}`);
});

test('build: the frame bullets of design section 5', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /integration branch/i);
  assert.match(body, /feat\/<slug>/);
  assert.match(body, /never create a second/i);
  assert.match(body, /subagent_type[^\n]*forge-sdlc:researcher/);
  assert.match(body, /\.forge\/notes\/<slug>\//);
  assert.match(body, /subagent_type[^\n]*forge-sdlc:implementer/);
  assert.match(body, /\.forge\/worktrees\/<slug>-<nn>/);
  assert.match(body, /slice\/<slug>-<nn>/);
  assert.match(body, /symlink/i);
  assert.match(body, /## Worktrees/);
  assert.match(body, /dependency_dir/);
  for (const dir of ['node_modules', '.venv', 'vendor']) assert.ok(body.includes(dir), `falls back to ${dir}`);
  assert.match(body, /pointers/i);
  assert.match(body, /proof/i);
  assert.match(body, /subagent_type[^\n]*forge-sdlc:verifier/);
  assert.match(body, /\.forge\/verify\/<slug>-<nn>\.json/);
  assert.match(body, /Stop hook/);
  assert.match(body, /subagent_type[^\n]*forge-sdlc:merger/);
  assert.match(body, /foreground/);
  assert.match(body, /frontier/i);
  assert.match(body, /max_parallel_slices/);
  assert.match(body, /background/);
  assert.match(body, /blocked by a red slice/i);
});

test('build: step 7 is replaced by the PR body, never a second code-review', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /[Ss]tep 7[^\n]*replaced/);
  assert.match(body, /skill-path\.mjs" pr/);
  for (const section of ['## Summary', '## Evidence', '## Merge Danger', '## Flagged concerns', '## Red slices']) {
    assert.ok(body.includes(section), section);
  }
  assert.match(body, /one bullet per slice/i);
  assert.match(body, /PR\.md/);
  assert.match(body, /gh pr ready/);
});

test('build: state ends at stage built, gate pr, slice statuses per contracts', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /\.forge\/state\.json/);
  assert.match(body, /stage: built/);
  assert.match(body, /gate: pr/);
  for (const status of ['building', 'verified', 'merged', 'red']) assert.ok(body.includes(status), status);
  assert.match(body, /writeState/);
});

test('build: unattended, AskUserQuestion is never called, open choices recorded on the ticket', () => {
  const { body } = frontmatter(read(SKILL));
  assert.match(body, /unattended/i);
  assert.match(body, /AskUserQuestion/);
  assert.match(body, /recorded on the ticket/i);
  assert.match(body, /Gate 4/);
});

test('build: every linked file exists', () => {
  const text = read(SKILL);
  for (const link of relativeLinks(text)) assert.ok(existsSync(path.join(plugin, 'skills', 'build', link)), link);
});

for (const name of ['implement-spec', 'pr']) {
  test(`build: no line of the upstream ${name} file is copied into the skill`, (t) => {
    const upstream = installedUpstream({ env: process.env, projectDir: repo });
    const file = upstream && skillFile(upstream.root, name);
    if (!file) return t.skip('set MATTPOCOCK_SKILLS_ROOT to the pocock-skills root to compare against the upstream file');
    const skill = read(SKILL);
    const lines = readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 40 && !l.startsWith('#'));
    for (const line of lines) assert.ok(!skill.includes(line), `upstream line pasted: ${line}`);
  });
}

/* The members reference */

test('members: the reference beside build names the script, the name, the agent write, the wait and the shutdown', () => {
  assert.ok(existsSync(path.join(plugin, MEMBERS)), MEMBERS);
  const text = read(MEMBERS);
  assert.match(text, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/crew-name\.mjs" <role> --project [^\n]*--effort <slug>/);
  assert.match(text, /--slice <slug>-<nn>/);
  assert.match(text, /as the call's `name`/);
  assert.match(text, /slices\["<slug>-<nn>"\]\.agent/);
  assert.match(text, /the member's report arrives/);
  assert.match(text, /task notification/);
  assert.match(text, /idle_notification[^\n]*`result`/);
  assert.match(text, /verify record[^\n]*evidence|evidence[^\n]*verify record/);
  assert.match(text, /SendMessage[^\n]*shutdown request|shutdown request[^\n]*SendMessage/);
  assert.match(text, /merges or goes red/);
  for (const link of relativeLinks(text)) assert.ok(existsSync(path.join(plugin, 'skills', 'build', link)), link);
});

/* The implementer */

test('implementer: Opus high, everything but Agent and AskUserQuestion', () => {
  const { fields } = frontmatter(read(IMPLEMENTER));
  assert.equal(fields.name, 'implementer');
  assert.equal(fields.model, 'claude-opus-5-5');
  assert.equal(fields.effort, 'high');
  assert.deepEqual(toolsOf(fields.disallowedTools).sort(), ['Agent', 'AskUserQuestion']);
  assert.equal(fields.tools, undefined);
});

test('implementer: worktree on the effort tip, tdd through the Skill tool, tracer bullets, small conventional commits', () => {
  const { body } = frontmatter(read(IMPLEMENTER));
  assert.match(body, /merge-base/);
  assert.match(body, /mattpocock-skills:tdd/);
  assert.match(body, /tracer bullet/i);
  assert.match(body, /conventional/i);
  assert.match(body, /merge[^\n]*effort[^\n]*tip|effort[^\n]*tip[^\n]*merge/i);
});

test('implementer: runs the verify-record script with its real flags before reporting', () => {
  const { body } = frontmatter(read(IMPLEMENTER));
  assert.match(body, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/verify-record\.mjs"/);
  for (const flag of ['--slice', '--worktree', '--project', '--proof']) assert.ok(body.includes(flag), flag);
  assert.match(body, /\.forge\/verify\/<slug>-<nn>\.json/);
});

test('implementer: fix mode set before code, cleared after; never reviews; reports branch, commits, record', () => {
  const { body } = frontmatter(read(IMPLEMENTER));
  assert.match(body, /slices\["<slug>-<nn>"\]\.mode/);
  assert.doesNotMatch(body, /efforts\.<slug>\.mode/);
  assert.match(body, /mode: fix/);
  assert.match(body, /mode: normal/);
  assert.match(body, /\.forge\/state\.json/);
  assert.match(body, /Important/);
  assert.match(body, /review/i);
  assert.match(body, /report/i);
  assert.match(body, /commits/);
});

/* The merger */

test('merger: Sonnet low, scoped to git, Skill, Agent and read', () => {
  const { fields } = frontmatter(read(MERGER));
  assert.equal(fields.name, 'merger');
  assert.equal(fields.model, 'claude-sonnet-5-5');
  assert.equal(fields.effort, 'low');
  const tools = toolsOf(fields.tools);
  for (const t of ['Bash', 'Read', 'Skill', 'Agent']) assert.ok(tools.includes(t), t);
  assert.ok(!tools.includes('AskUserQuestion'));
});

test('merger: reads a fresh green record and never runs tests itself', () => {
  const { body } = frontmatter(read(MERGER));
  assert.match(body, /\.forge\/verify\/<slug>-<nn>\.json/);
  assert.match(body, /fresh/);
  assert.match(body, /rev-parse HEAD/);
  assert.match(body, /green/);
  assert.doesNotMatch(body, /verify-record\.mjs/);
});

test('merger: runs slice-review and reads its last line', () => {
  const { body } = frontmatter(read(MERGER));
  assert.match(body, /slice-review/);
  assert.match(body, /<slug>-<nn>: clean/);
  assert.match(body, /<slug>-<nn>: red/);
});

test('merger: clean merges --no-ff, pushes feat/<slug> only, deletes branch and worktree, resolves the ticket, status merged', () => {
  const { body } = frontmatter(read(MERGER));
  assert.match(body, /merge --no-ff/);
  assert.match(body, /git push origin feat\/<slug>/);
  assert.match(body, /git worktree remove/);
  assert.match(body, /git branch -d/);
  assert.match(body, /docs\/agents\/issue-tracker\.md/);
  assert.match(body, /\.forge\/review\/<slug>-<nn>\.md/);
  assert.match(body, /merged/);
});

test('merger: red merges nothing, keeps branch and worktree, findings on the ticket, status red', () => {
  const { body } = frontmatter(read(MERGER));
  assert.match(body, /red/);
  assert.match(body, /merge nothing|merges nothing/i);
  assert.match(body, /keep|stay/i);
  assert.match(body, /findings/);
});

test('seams: the implementer works from its worktree, and a by-file chain names the resolved plugin root', () => {
  assert.match(frontmatter(read(IMPLEMENTER)).body, /first Bash call is `cd <worktree>`/);
  assert.match(frontmatter(read(MERGER)).body, /plugin-root variable unresolved[^\n]*\$\{CLAUDE_PLUGIN_ROOT\}/);
});
