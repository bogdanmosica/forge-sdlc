// The plan skill, structurally: its frontmatter, the steps and pointers the design's section 5
// requires, the template's frontmatter and columns, every linked file present, and the upstream
// to-tickets procedure pointed at rather than pasted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installedUpstream, readLock, skillFile } from '../plugins/forge-sdlc/bin/upstream.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(repo, 'plugins', 'forge-sdlc', 'skills', 'plan');
const skill = readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
const template = readFileSync(path.join(dir, 'PLAN-TEMPLATE.md'), 'utf8');

const frontmatterOf = (text) => /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';

test('SKILL.md frontmatter: user-invoked, named plan, takes a slug', () => {
  const fm = frontmatterOf(skill);
  assert.match(fm, /^name: plan$/m);
  assert.match(fm, /^description: .{20,}$/m);
  assert.match(fm, /^disable-model-invocation: true$/m);
  assert.match(fm, /^argument-hint: <slug>$/m);
});

test('the precondition: spec.md committed, the spec gate passed, status accepted written into it', () => {
  assert.match(skill, /^## .*Precondition/mi);
  assert.match(skill, /docs\/efforts\/<slug>\/spec\.md/);
  assert.match(skill, /gate.*spec|spec.*gate/i);
  assert.match(skill, /status: accepted/);
  assert.match(skill, /\/forge-sdlc:spec <slug>/);
});

test('to-tickets is resolved by file through skill-path.mjs and every locked step is named, never pasted', () => {
  assert.match(skill, /skill-path\.mjs" to-tickets/);
  assert.match(skill, /mattpocock-skills:to-tickets|to-tickets/);
  for (const heading of readLock().skills['to-tickets']) {
    const title = heading.replace(/^#+\s*\d+\.\s*/, '').replace(/ to the configured tracker$/, '');
    assert.ok(skill.includes(title), `names the to-tickets step "${title}"`);
  }
  for (const pasted of [
    'cuts a narrow but COMPLETE path',
    'Make the change easy, then make the easy change',
    'Does the granularity feel right',
    '<vertical-slice-rules>',
    '<local-ticket-template>',
    '<issue-template>',
  ]) {
    assert.ok(!skill.includes(pasted), `upstream text pasted: ${pasted}`);
  }
});

test('no line of the upstream to-tickets file is copied into the skill', (t) => {
  const upstream = installedUpstream({ env: process.env, projectDir: repo });
  const file = upstream && skillFile(upstream.root, 'to-tickets');
  if (!file) return t.skip('set MATTPOCOCK_SKILLS_ROOT to the pocock-skills root to compare against the upstream file');
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 40 && !l.startsWith('#'));
  for (const line of lines) assert.ok(!skill.includes(line), `upstream line pasted: ${line}`);
});

test('the frame: tracer bullets, blocking edges, prefactoring first, expand-contract, nn in dependency order', () => {
  assert.match(skill, /tracer[- ]bullet/i);
  assert.match(skill, /blocking edge/i);
  assert.match(skill, /prefactor/i);
  assert.match(skill, /expand.contract/i);
  assert.match(skill, /\b01\b/);
  assert.match(skill, /slice\/<slug>-<nn>/);
  assert.match(skill, /dependency order/i);
});

test('the quiz is Gate 3: AskUserQuestion until the engineer approves', () => {
  assert.match(skill, /Gate 3/);
  assert.match(skill, /AskUserQuestion/);
  assert.match(skill, /approve/i);
});

test('every slice carries a proof line the verifier runs', () => {
  assert.match(skill, /\bproof\b/i);
  assert.match(skill, /verifier/i);
  assert.match(skill, /observable/i);
});

test('tickets publish per the tracker doc: blockers first, native blocking on GitHub, Blocked by locally, ready-for-agent', () => {
  assert.match(skill, /docs\/agents\/issue-tracker\.md/);
  assert.match(skill, /blockers first/i);
  assert.match(skill, /native/i);
  assert.match(skill, /Blocked by/);
  assert.match(skill, /ready-for-agent/);
  assert.match(skill, /\.scratch\/<slug>\/issues\//);
});

test('plan.md is written from the template, committed on feat/<slug>, and the PR body ## Plan (or PR.md) is updated', () => {
  assert.match(skill, /\[PLAN-TEMPLATE\.md\]\(PLAN-TEMPLATE\.md\)/);
  assert.match(skill, /docs\/efforts\/<slug>\/plan\.md/);
  assert.match(skill, /feat\/<slug>/);
  assert.match(skill, /## Plan/);
  assert.match(skill, /PR\.md/);
  assert.match(skill, /frontier/i);
});

test('state is written per contracts: stage plan, gate plan, slices open with their ticket pointer', () => {
  assert.match(skill, /\.forge\/state\.json/);
  assert.match(skill, /stage.{0,4}plan/);
  assert.match(skill, /gate.{0,4}plan/);
  assert.match(skill, /<slug>-<nn>/);
  assert.match(skill, /status.{0,4}open/);
  assert.match(skill, /ticket/);
  assert.match(skill, /writeState|lib\.mjs/);
});

test('every relative link in SKILL.md resolves to a file beside it', () => {
  const links = [...skill.matchAll(/\]\(([^)#]+)\)/g)].map((m) => m[1]).filter((l) => !/^[a-z]+:/.test(l));
  assert.ok(links.length > 0);
  for (const link of links) assert.ok(existsSync(path.join(dir, link)), link);
});

test('PLAN-TEMPLATE.md: frontmatter per contracts, the slice table columns, the four sections', () => {
  const fm = frontmatterOf(template);
  assert.match(fm, /^effort: /m);
  assert.match(fm, /^stage: plan$/m);
  assert.match(fm, /^status: /m);
  assert.match(fm, /^risk: /m);
  assert.match(fm, /^updated: /m);
  const header = template.split('\n').find((l) => /^\|\s*nn\s*\|/.test(l));
  assert.ok(header, 'a table whose first column is nn');
  const columns = header.split('|').map((c) => c.trim()).filter(Boolean);
  assert.deepEqual(columns, ['nn', 'title', 'blocked by', 'delivers', 'proof']);
  for (const heading of ['## Slices', '## Order of work', '## Risks', '## Prefactoring']) {
    assert.match(template, new RegExp(`^${heading}$`, 'm'), heading);
  }
});

test('every numbered step of SKILL.md ends on a completion criterion', () => {
  const steps = skill.split(/^## (?=\d+\. )/m).slice(1);
  assert.ok(steps.length >= 6, 'at least six numbered steps');
  for (const step of steps) assert.match(step, /Done when /, step.split('\n')[0]);
});

test('plan: each slice enters state with status open and mode normal (docs/contracts.md)', () => {
  const body = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'skills', 'plan', 'SKILL.md'), 'utf8');
  assert.match(body, /"status": "open", "mode": "normal", "ticket"/);
});

/* Gate policy (skills/wayfinder/GATE-POLICY.md) */

const step = (n) => new RegExp(`^## ${n}\\. .*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(skill)?.[1] ?? '';
const QUIZ = ['granularity', 'blocking edges', 'merge or split', 'proofs'];

test('plan step 3: the dialog quiz under attended or risk high; under autonomous the drafted breakdown answers it', () => {
  const step3 = step(3);
  assert.ok(step3.includes('](../wayfinder/GATE-POLICY.md)'), 'links the gate policy reference');
  assert.match(step3, /`attended`[^\n]*`risk: high`[^\n]*AskUserQuestion|AskUserQuestion[^\n]*`attended`/);
  assert.match(step3, /`autonomous`[^\n]*`risk: normal`[^\n]*drafted breakdown/);
  assert.ok(step3.includes(`quiz's order: ${QUIZ.join(', ')}`), 'the four answers in the quiz order');
  assert.match(step3, /`recommended:`[^\n]*`\(source: policy autonomous\)`/);
  assert.match(step3, /Done when /);
});

test('PLAN-TEMPLATE.md: ## Quiz after ## Prefactoring, written under the autonomous policy only, four recommended lines', () => {
  assert.match(template, /^## Quiz$/m);
  assert.ok(template.indexOf('## Quiz') > template.indexOf('## Prefactoring'), '## Quiz comes after ## Prefactoring');
  const quiz = template.slice(template.indexOf('## Quiz'));
  assert.match(quiz, /autonomous/);
  const lines = quiz.split('\n').filter((l) => l.startsWith('- recommended: '));
  assert.equal(lines.length, 4);
  QUIZ.forEach((q, k) => assert.ok(lines[k].startsWith(`- recommended: ${q}: `), q));
  for (const l of lines) assert.match(l, /\(source: policy autonomous\)$/);
});

test('plan steps 1, 5, 6 and 7: a policy-passed Gate 2, the Quiz block in plan.md and the PR body, the Gate 3 passed line', () => {
  assert.match(step(1), /policy[^\n]*Gate 2|Gate 2[^\n]*policy/);
  assert.match(step(5), /`## Quiz`[^\n]*after `## Prefactoring`[^\n]*`autonomous` only/);
  assert.match(step(6), /`## Plan`[^\n]*Quiz[^\n]*under the slice table|under the slice table[^\n]*Quiz/);
  assert.match(step(6), /drop(s|ping)? `stop`/);
  assert.match(step(7), /`Gate 3 passed: policy autonomous, nothing open`/);
});
