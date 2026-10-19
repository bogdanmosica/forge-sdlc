// The build skill and its two agents, structurally: frontmatter and tool scoping, the
// implement-spec steps under the frame of design section 5, step 7 replaced, no AskUserQuestion,
// the verifier script named with its real flags, linked files present, the upstream procedure
// pointed at rather than pasted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

test("build: the lead ends a slice's implementer after its merger reports merged or red", () => {
  const { body } = frontmatter(read(SKILL));
  const step5 = body.split('\n').find((l) => l.includes('**Step 5**'));
  assert.match(step5, /merged` or `red`[^\n]*end that slice's implementer/);
  assert.match(step5, /shutdown request/);
});

test("build: the Gate 4 report names each slice's member", () => {
  const { body } = frontmatter(read(SKILL));
  const gate4 = body.slice(body.indexOf('## 4. Gate 4'));
  assert.match(gate4, /one line per slice, `<slug>-<nn>: <member>`/);
});

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

test('build: every Agent call is a member call linking the reference with its role', () => {
  const { body } = frontmatter(read(SKILL));
  const lines = body.split('\n');
  for (const role of ['researcher', 'implementer', 'verifier', 'merger']) {
    const line = lines.find((l) => l.includes(`subagent_type: "forge-sdlc:${role}"`));
    assert.ok(line, `an Agent call for ${role}`);
    assert.match(line, /\[member call\]\(MEMBERS\.md\)/, `${role} links the reference`);
    assert.ok(line.includes(`role \`${role}\``), `${role} names its role`);
  }
  assert.doesNotMatch(body, /foreground Agent call/);
  assert.match(body, /role `implementer` with `--slice <slug>-<nn>`/);
});

test("build: step 4 records the implementer's agent id on its slice", () => {
  const { body } = frontmatter(read(SKILL));
  const step4 = body.split('\n').find((l) => l.includes('**Step 4**'));
  assert.match(step4, /slices\["<slug>-<nn>"\]\.agent/);
});

test('members: only the reference speaks of the transport (teammate, task notification)', () => {
  const skills = path.join(plugin, 'skills');
  const files = readdirSync(skills, { recursive: true })
    .filter((f) => f.endsWith('.md'))
    .filter((f) => path.join('skills', f) !== MEMBERS);
  assert.ok(files.length > 1);
  for (const f of files) {
    const text = readFileSync(path.join(skills, f), 'utf8');
    assert.doesNotMatch(text, /teammate|task notification/i, f);
  }
  assert.match(read(MEMBERS), /teammate/);
});

test('members: design section 5 records the member call with a Decision line to its ADR', () => {
  const design = readFileSync(path.join(repo, 'docs', 'design.md'), 'utf8');
  const section5 = design.slice(design.indexOf('## 5. Commands'), design.indexOf('## 6. The agents'));
  const decision = section5.split('\n').find((l) => /^Decision \(members\)/.test(l));
  assert.ok(decision, 'a Decision (members) line in section 5');
  const adr = /\]\((adr\/0017-agents-as-named-members\.md)\)/.exec(decision);
  assert.ok(adr, 'links ADR 0017');
  const file = path.join(repo, 'docs', adr[1]);
  assert.ok(existsSync(file), adr[1]);
  assert.match(readFileSync(file, 'utf8'), /^# 17\. Agents as named members$/m);
  assert.match(section5, /skills\/build\/MEMBERS\.md/);
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

test('merger: a member the lead starts, clearing the slice\'s agent when it writes merged or red', () => {
  const { fields, body } = frontmatter(read(MERGER));
  assert.doesNotMatch(fields.description, /foreground/);
  const merge = body.slice(body.indexOf('3. **Merge**'), body.indexOf('4. **Red**'));
  const red = body.slice(body.indexOf('4. **Red**'), body.indexOf('5. **Report**'));
  for (const [step, text] of [['merge', merge], ['red', red]]) {
    assert.match(text, /clear[^\n]*`agent`/, `${step} clears agent`);
  }
});

test('seams: the implementer works from its worktree, and a by-file chain names the resolved plugin root', () => {
  assert.match(frontmatter(read(IMPLEMENTER)).body, /first Bash call is `cd <worktree>`/);
  assert.match(frontmatter(read(MERGER)).body, /plugin-root variable unresolved[^\n]*\$\{CLAUDE_PLUGIN_ROOT\}/);
});
