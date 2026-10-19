// The spec skill, its extras file and the spec-writer agent: structure, pointers, and no
// pasted upstream template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readLock } from '../plugins/forge-sdlc/bin/upstream.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const skillDir = path.join(root, 'skills', 'spec');
const read = (file) => readFileSync(file, 'utf8');

const skill = read(path.join(skillDir, 'SKILL.md'));
const extras = read(path.join(skillDir, 'SPEC-EXTRAS.md'));
const agent = read(path.join(root, 'agents', 'spec-writer.md'));

/** `{ frontmatter, body }` of a markdown file with a YAML frontmatter block. */
const split = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, 'frontmatter block');
  return { frontmatter: m[1], body: m[2] };
};

const EXTRA_SECTIONS = ['## Affected users and systems', '## Flagged concerns', '## Assumptions to confirm'];
const hasLine = (text, line) => text.split('\n').some((l) => l.trimEnd() === line);

test('spec/SKILL.md: user-invoked, takes <slug>, name matches the folder', () => {
  const { frontmatter } = split(skill);
  assert.match(frontmatter, /^name: spec$/m);
  assert.match(frontmatter, /^description: .+/m);
  assert.match(frontmatter, /^disable-model-invocation: true$/m);
  assert.match(frontmatter, /^argument-hint: "?<slug>"?$/m);
});

test('spec/SKILL.md: the frame the design requires, by pointer', () => {
  const { body } = split(skill);
  assert.match(body, /intent\.md/);
  assert.match(body, /`?open:`?/, 'an open: assumption stops the stage');
  assert.match(body, /forge-sdlc:spec-writer/);
  assert.match(body, /skill-path\.mjs"? to-spec/, 'to-spec is read by file through the resolver');
  assert.match(body, /GLOSSARY\.md/);
  assert.match(body, /docs\/adr/);
  assert.match(body, /Policy skills/);
  assert.match(body, /docs\/agents\/issue-tracker\.md/);
  assert.match(body, /ready-for-agent/);
  assert.match(body, /needs-tech-lead/);
  assert.match(body, /risk: high/);
  assert.match(body, /PR\.md/, 'the local gate record');
  assert.match(body, /\.forge\/state\.json/);
  assert.match(body, /Gate 2/);
  assert.match(body, /only-on-open/);
  for (const section of ['## Spec', '## Flagged concerns', '## Assumptions to confirm']) {
    assert.ok(body.includes(`\`${section}\``), `names the PR body section ${section}`);
  }
});

test('spec/SKILL.md: every relative link resolves beside the skill', () => {
  const links = [...skill.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]).filter((l) => !/^[a-z]+:/.test(l));
  assert.ok(links.includes('SPEC-EXTRAS.md'), 'links the extras file');
  for (const link of links) assert.ok(existsSync(path.join(skillDir, link)), link);
});

test('SPEC-EXTRAS.md: the three added sections and the contract frontmatter', () => {
  for (const section of EXTRA_SECTIONS) assert.ok(hasLine(extras, section), section);
  for (const key of ['effort: <slug>', 'stage: spec', 'status: draft', 'risk: normal | high', 'updated:']) {
    assert.ok(extras.includes(key), `frontmatter ${key}`);
  }
  assert.match(extras, /- recommended: /);
  assert.match(extras, /- open: /);
});

test('no file of the slice pastes the upstream to-spec template', () => {
  const headings = readLock().skills['to-spec'];
  assert.ok(headings.length > 0);
  for (const [name, text] of [['SKILL.md', skill], ['SPEC-EXTRAS.md', extras], ['spec-writer.md', agent]]) {
    for (const heading of headings) assert.ok(!hasLine(text, heading), `${name} carries ${heading}`);
    assert.ok(!text.includes('<spec-template>'), `${name} carries the template tag`);
    assert.ok(!text.includes('I want a <feature>'), `${name} carries the user-story example`);
  }
});

test('agents/spec-writer.md: Opus, high, read and search, writes the spec only', () => {
  const { frontmatter, body } = split(agent);
  assert.match(frontmatter, /^name: spec-writer$/m);
  assert.match(frontmatter, /^description: .+/m);
  assert.match(frontmatter, /^model: claude-opus-5-5$/m);
  assert.match(frontmatter, /^effort: high$/m);
  const tools = /^tools: (.+)$/m.exec(frontmatter);
  assert.ok(tools, 'a tools whitelist');
  const list = tools[1].split(',').map((t) => t.trim());
  for (const t of ['Read', 'Glob', 'Grep', 'Write', 'Skill']) assert.ok(list.includes(t), t);
  for (const t of ['Bash', 'Agent', 'AskUserQuestion', 'NotebookEdit']) assert.ok(!list.includes(t), t);
  assert.match(body, /docs\/efforts\/<slug>\/spec\.md/);
  assert.match(body, /SPEC-EXTRAS\.md/);
  assert.match(body, /seam/i);
  assert.match(body, /ask(s)? nothing|never ask/i);
  for (const section of EXTRA_SECTIONS) assert.ok(body.includes(section), section);
  assert.match(body, /^1\. /m, 'numbered steps');
  assert.ok(body.trim().split('\n').length <= 45, 'brief fits on one screen');
});
test('spec: running it accepts Gate 1, so intent.md is set to status: accepted and commits with the spec', () => {
  assert.match(skill, /accepts Gate 1[^\n]*`status: accepted`/);
});

/* Members (the member call of skills/build/MEMBERS.md) */

test('spec/SKILL.md: the spec-writer is a member call naming its role, the reference read by path', () => {
  const { body } = split(skill);
  const line = body.split('\n').find((l) => l.includes('subagent_type: "forge-sdlc:spec-writer"'));
  assert.ok(line, 'an Agent call for the spec-writer');
  assert.ok(line.includes('[member call](../build/MEMBERS.md)'), 'links the members reference');
  assert.ok(line.includes('role `spec-writer`'), 'names its role');
  assert.doesNotMatch(body, /foreground Agent call/);
  assert.match(body, /\(\.\.\/build\/MEMBERS\.md\)[^\n]*lead[^\n]*plugin-root variable unresolved[^\n]*\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.doesNotMatch(skill, /teammate|task notification/i);
});
