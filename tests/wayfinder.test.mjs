// The wayfinder skill, its templates and its two agents, tested for structure: frontmatter,
// the headings and pointers the design requires (section 5, "wayfinder"), every linked file
// exists, and the upstream procedure is pointed at by file, never pasted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installedUpstream, skillFile } from '../plugins/forge-sdlc/bin/upstream.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const skillDir = path.join(plugin, 'skills', 'wayfinder');
const read = (rel) => readFileSync(path.join(plugin, rel), 'utf8');
const skill = read('skills/wayfinder/SKILL.md');
const frontmatter = (text) => /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';

test('SKILL.md frontmatter: name, description, user-invoked, argument hint', () => {
  const fm = frontmatter(skill);
  assert.match(fm, /^name: wayfinder$/m);
  assert.match(fm, /^description: .{20,}$/m);
  assert.match(fm, /^disable-model-invocation: true$/m);
  assert.match(fm, /^argument-hint: "<idea> \| #issue \| <slug>"$/m);
});

test('follows the upstream wayfinder by file through the resolver and stops on exit 1 with the install line', () => {
  assert.match(skill, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/skill-path\.mjs" wayfinder/);
  assert.match(skill, /exit 1/);
  assert.match(skill, /install line/i);
  assert.doesNotMatch(skill, /Skill tool[^\n]*mattpocock-skills:wayfinder/);
});

test('the Destination is written under the intent headings', () => {
  assert.match(skill, /Destination/);
  for (const heading of ['Problem', 'Outcome', 'Users', 'Constraints', 'Open questions']) {
    assert.match(skill, new RegExp(`### ${heading}`), heading);
  }
});

test('map.md commits on feat/<slug>, cut from the default branch, as the first commit and per resolved ticket', () => {
  assert.match(skill, /docs\/efforts\/<slug>\/map\.md/);
  assert.match(skill, /feat\/<slug>/);
  assert.match(skill, /default branch/);
  assert.match(skill, /first commit/);
  assert.match(skill, /wayfinder:map/);
  assert.match(skill, /docs\/agents\/issue-tracker\.md/);
});

test('the four ticket types and who resolves each', () => {
  for (const type of ['grilling', 'research', 'prototype', 'task']) {
    assert.match(skill, new RegExp(`wayfinder:${type}`), type);
  }
  assert.match(skill, /mattpocock-skills:grilling/);
  assert.match(skill, /mattpocock-skills:domain-modeling/);
  assert.match(skill, /forge-sdlc:researcher/);
  assert.match(skill, /forge-sdlc:prototyper/);
  assert.match(skill, /HITL/);
  assert.match(skill, /background/);
});

test('intent.md from the template, assumption lines, risk from the host Risk globs', () => {
  assert.match(skill, /docs\/efforts\/<slug>\/intent\.md/);
  assert.match(skill, /\[INTENT-TEMPLATE\.md\]\(INTENT-TEMPLATE\.md\)/);
  assert.match(skill, /\[ASSUMPTIONS\.md\]\(ASSUMPTIONS\.md\)/);
  assert.match(skill, /risk: high/);
  assert.match(skill, /forge-config\.mjs/);
});

test('the draft PR (or PR.md without a remote) with the Intent and Assumptions sections, state.json, Gate 1 stop', () => {
  assert.match(skill, /gh pr create[^\n]*--draft/);
  assert.match(skill, /docs\/efforts\/<slug>\/PR\.md/);
  assert.match(skill, /## Intent/);
  assert.match(skill, /## Assumptions to confirm/);
  assert.match(skill, /\.forge\/state\.json/);
  assert.match(skill, /"stage": "intent"/);
  assert.match(skill, /"gate": "intent"/);
  assert.match(skill, /Gate 1/);
});

test('a slug is told from an idea by effort-state.mjs and goes to Resume', () => {
  const step1 = /^## 1\. Resolve the input\n([\s\S]*?)(?=^## )/m.exec(skill)[1];
  assert.match(step1, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/effort-state\.mjs" \. <slug>/);
  assert.match(step1, /\[Resume\]\(#resume\)/);
  assert.match(step1, /[Ee]xit 1[^\n]*idea/);
});

test('Resume: announce stage and gate, reopen settled open: lines, run the next stage by file, stop at its gate', () => {
  const resume = /^## Resume\n+([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(skill);
  assert.ok(resume, 'a ## Resume section');
  const r = resume[1];
  const steps = [...r.matchAll(/^\d+\. \*\*[^*]+\*\*[\s\S]*?(?=^\d+\. |(?![\s\S]))/gm)].map((m) => m[0]);
  assert.equal(steps.length, 3, 'three numbered steps');
  for (const step of steps) assert.match(step, /Done when [^\n]+\.\s*$/, step.slice(0, 40));
  assert.match(r, /effort-state\.mjs/);
  assert.match(r, /stage <stage>, gate <gate>/);
  assert.match(r, /source: artifacts/);
  assert.match(r, /\.forge\/state\.json/);
  assert.match(r, /open:/);
  assert.match(r, /## Assumptions to confirm/);
  assert.match(r, /gh pr view/);
  assert.match(r, /PR\.md/);
  assert.match(r, /reopens its map ticket/);
  assert.match(r, /step 4/);
  assert.match(r, /forge-sdlc:<next>/);
  assert.match(r, /\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/<next>\/SKILL\.md/);
  for (const next of ['map', 'spec', 'plan', 'build', 'none']) assert.match(r, new RegExp(`\`${next}\``), next);
  assert.match(r, /Gate 4/);
  for (const stage of ['spec', 'plan', 'build']) {
    assert.ok(existsSync(path.join(plugin, 'skills', stage, 'SKILL.md')), `skills/${stage}/SKILL.md`);
  }
});

test('every relative link in the skill resolves to a file beside it', () => {
  const links = [...skill.matchAll(/\]\(([^)#]+)\)/g)].map((m) => m[1]).filter((l) => !/^[a-z]+:/.test(l));
  assert.ok(links.length >= 2);
  for (const link of links) assert.ok(existsSync(path.join(skillDir, link)), link);
});

test('the upstream procedure is not pasted: the frame points at the file', () => {
  for (const sentence of [
    'deliberately_ incomplete',
    "Plan, don't do",
    'Refer by name',
    'The test is whether you can state the question precisely now',
    'Fog only ever gathers',
    'never resolve more than one ticket per session',
    'Blocking uses the tracker',
  ]) {
    assert.ok(!skill.includes(sentence), `pasted upstream text: ${sentence}`);
  }
  assert.ok(skill.split('\n').length < 110, 'under one screen and a half');
});

test('no line of the upstream wayfinder file is copied into the skill', (t) => {
  const upstream = installedUpstream({ env: process.env, projectDir: path.resolve(plugin, '..', '..') });
  const file = upstream && skillFile(upstream.root, 'wayfinder');
  if (!file) return t.skip('set MATTPOCOCK_SKILLS_ROOT to the pocock-skills root to compare against the upstream file');
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 40 && !l.startsWith('#'));
  for (const line of lines) assert.ok(!skill.includes(line), `upstream line pasted: ${line}`);
});

test('INTENT-TEMPLATE.md: artifact frontmatter and the intent headings', () => {
  const t = read('skills/wayfinder/INTENT-TEMPLATE.md');
  const fm = frontmatter(t);
  for (const key of ['effort', 'stage: intent', 'status', 'risk', 'updated']) assert.match(fm, new RegExp(`^${key}`, 'm'), key);
  for (const h of ['Problem', 'Outcome', 'Users', 'Constraints', 'Open questions', 'Decisions so far', 'Out of scope', 'Assumptions to confirm']) {
    assert.match(t, new RegExp(`^## ${h}$`, 'm'), h);
  }
});

test('ASSUMPTIONS.md: the two line shapes of docs/contracts.md', () => {
  const a = read('skills/wayfinder/ASSUMPTIONS.md');
  assert.match(a, /^- recommended: .*\(source: .*\)$/m);
  assert.match(a, /^- open: /m);
  assert.match(a, /open.*first|first.*open/i);
});

test('researcher: Sonnet, medium, read/search/web, writes only under docs/research/ and .forge/notes/', () => {
  const a = read('agents/researcher.md');
  const fm = frontmatter(a);
  assert.match(fm, /^name: researcher$/m);
  assert.match(fm, /^model: claude-sonnet-5-5$/m);
  assert.match(fm, /^effort: medium$/m);
  const tools = /^tools: (.*)$/m.exec(fm)?.[1] ?? '';
  for (const t of ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']) assert.ok(tools.includes(t), t);
  assert.ok(!tools.includes('Agent'));
  assert.match(a, /docs\/research\/<slug>\//);
  assert.match(a, /\.forge\/notes\/<slug>\//);
  assert.match(a, /mattpocock-skills:research/);
  assert.match(a, /primary source/);
});

test('prototyper: Opus, high, worktree isolation, everything but Agent, throwaway code, verdict only', () => {
  const a = read('agents/prototyper.md');
  const fm = frontmatter(a);
  assert.match(fm, /^name: prototyper$/m);
  assert.match(fm, /^model: claude-opus-5-5$/m);
  assert.match(fm, /^effort: high$/m);
  assert.match(fm, /^isolation: worktree$/m);
  assert.match(fm, /^disallowedTools: Agent$/m);
  assert.doesNotMatch(fm, /^tools:/m);
  assert.match(a, /mattpocock-skills:prototype/);
  assert.match(a, /throwaway/i);
  assert.match(a, /verdict/);
});

/* Members (the member call of skills/build/MEMBERS.md) */

const MEMBER_LINK = '[member call](../build/MEMBERS.md)';
const agentRow = (agent) => skill.split('\n').find((l) => l.startsWith('|') && l.includes(`forge-sdlc:${agent}`));

test('the researcher and prototyper are member calls naming their roles', () => {
  for (const role of ['researcher', 'prototyper']) {
    const row = agentRow(role);
    assert.ok(row, `a table row for ${role}`);
    assert.ok(row.includes(MEMBER_LINK), `${role} links the members reference`);
    assert.ok(row.includes(`role \`${role}\``), `${role} names its role`);
  }
});

test('each member row says how it runs: researchers in the background at once, the prototyper in the foreground', () => {
  assert.ok(agentRow('researcher').includes('in the background, all at once'), 'researchers run in the background, all at once');
  assert.ok(agentRow('prototyper').includes('foreground under a plain lead'), 'the prototyper runs in the foreground under a plain lead');
});

test('the prototyper call passes isolation on the call itself, so it keeps its own worktree under any lead', () => {
  assert.match(agentRow('prototyper'), /passes `isolation: "worktree"` on the call/);
  assert.doesNotMatch(agentRow('researcher'), /isolation/);
});

test('this session is the lead of its member calls, reading the reference by path; no transport words', () => {
  const line = skill.split('\n').find((l) => /\(\.\.\/build\/MEMBERS\.md\)[^\n]*plugin-root variable unresolved/.test(l));
  assert.ok(line, 'the by-path sentence at the member calls');
  assert.match(line, /lead[^\n]*plugin-root variable unresolved[^\n]*\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.doesNotMatch(skill, /teammate|task notification/i);
});

/* The gate policy (skills/wayfinder/GATE-POLICY.md, ADR 0018) */

const GATE_LINK = '[gate policy](GATE-POLICY.md)';
const section = (heading) => new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(skill)?.[1] ?? '';

test('GATE-POLICY.md beside wayfinder: the four stops, the three reasons in order, the report line, the state write', () => {
  const file = path.join(skillDir, 'GATE-POLICY.md');
  assert.ok(existsSync(file), 'skills/wayfinder/GATE-POLICY.md');
  const ref = readFileSync(file, 'utf8');
  assert.match(ref, /`gates\.policy`/);
  assert.match(ref, /`attended`/);
  assert.match(ref, /`autonomous`/);
  assert.match(ref, /no `open:` line/);
  assert.match(ref, /other than `- none`/);
  assert.match(ref, /`risk: normal`/);
  assert.match(ref, /Gate 4[^\n]*always stops/);
  assert.match(ref, /`spec:` key/);
  const reasons = ['open', 'flagged', 'risk-high'].map((r) => ref.indexOf(`| \`${r}\` |`));
  assert.ok(reasons.every((i) => i > 0), 'a row per stop reason');
  assert.deepEqual([...reasons].sort((a, b) => a - b), reasons, 'reasons in the order open, flagged, risk-high');
  assert.match(ref, /first in that order[^\n]*written[^\n]*names all of them/);
  assert.match(ref, /^`Gate <n> passed: policy autonomous, nothing open`$/m);
  assert.match(ref, /`stop: <reason>` beside `gate`/);
  assert.match(ref, /every other stage state write drops `stop`/i);
  assert.match(ref, /Gate 4 writes none/);
  assert.match(ref, /runs attended from here/);
});

test('step 1 keeps the gate policy with the default branch and the risk globs', () => {
  const step1 = section('1\\. Resolve the input');
  assert.match(step1, /default branch[^\n]*`risk\.high` globs[^\n]*`gates\.policy`/);
});

test('step 7 applies the gate policy: attended stops, a policy pass continues into spec, a stop writes stop', () => {
  const step7 = section('7\\. [^\\n]*');
  assert.ok(step7.includes(GATE_LINK), 'step 7 links the gate policy');
  assert.match(step7, /`attended`[^\n]*this run ends here/);
  assert.match(step7, /`Gate 1 passed: policy autonomous, nothing open`[^\n]*\[Resume\]\(#resume\) step 3[^\n]*`spec`/);
  assert.match(step7, /`stop: <reason>`[^\n]*reasons/);
  assert.match(step7, /`risk-high`[^\n]*runs attended from here/);
  assert.match(step7, /Done when [^\n]+\.\s*$/);
});

test('Resume continues past every Gate <n> passed to the first stop or Gate 4, reading each next stage by file', () => {
  const r = section('Resume');
  assert.ok(r.includes(GATE_LINK), 'Resume links the gate policy');
  assert.match(r, /\{ slug, stage, gate, next, why, source, policy, stop \}/);
  const step3 = /^3\. \*\*Run the next stage\.\*\*[^\n]*/m.exec(r)?.[0] ?? '';
  assert.match(step3, /`Gate <n> passed`[^\n]*1, 2 or 3/);
  assert.match(step3, /next stage from `effort-state\.mjs`/);
  assert.match(step3, /first stop or (at )?Gate 4/);
  assert.match(step3, /SKILL\.md` when (that|the) stage starts/);
  assert.match(step3, /`only-on-open`[^\n]*same rule/);
  assert.doesNotMatch(step3, /After `spec`, a report of `Gate 2 passed` continues into `plan`/, 'the Gate 2 special case is folded into the rule');
});
