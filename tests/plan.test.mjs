// The plan skill, structurally: its frontmatter, the steps and pointers the design's section 5
// requires, the template's frontmatter and columns, every linked file present, and the upstream
// to-tickets procedure pointed at rather than pasted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installedUpstream, readLock, skillFile } from '../plugins/forge-sdlc/bin/upstream.mjs';
import { stepOf } from './support/skill.mjs';

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
  const steps = [1, 2, 3, 4, 5, 6, 7].map((n) => stepOf(skill, n));
  for (const [k, body] of steps.entries()) assert.match(body, /Done when /, `step ${k + 1}`);
  assert.equal(stepOf(skill, 8), '', 'no step 8 left unchecked');
});

test('plan: each slice enters state with status open and mode normal (docs/contracts.md)', () => {
  const body = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'skills', 'plan', 'SKILL.md'), 'utf8');
  assert.match(body, /"status": "open", "mode": "normal", "ticket"/);
});

/* Gate policy (skills/wayfinder/GATE-POLICY.md) */

const step = (n) => stepOf(skill, n);
const QUIZ = ['granularity', 'blocking edges', 'merge or split', 'proofs'];

test('plan step 3: the dialog quiz under attended or risk high; under autonomous the drafted breakdown answers it', () => {
  const step3 = step(3);
  assert.ok(step3.includes('](../wayfinder/GATE-POLICY.md)'), 'links the gate policy reference');
  assert.match(step3, /`attended`[^\n]*`risk: high`[^\n]*AskUserQuestion|AskUserQuestion[^\n]*`attended`/);
  assert.match(step3, /`autonomous`[^\n]*`risk: normal`[^\n]*drafted breakdown/);
  assert.match(step3, /`## Quiz`/, 'the four lines are the template\'s ## Quiz lines');
  assert.match(step3, /`recommended:`[^\n]*`\(source: policy autonomous\)`/);
  assert.match(step3, /Done when /);
});

test('plan step 3: an open: line among the Quiz lines stops Gate 3 under autonomous with stop: open', () => {
  const step3 = step(3);
  assert.match(step3, /`open:` line/);
  assert.match(step3, /`stop: open`/);
  assert.match(step3, /passes Gate 3|Gate 3 passes/);
  assert.match(step3, /Done when [^\n]*four Quiz lines/);
});

test('plan step 6: under autonomous a Gate 3 stop goes beside gate as the reference\'s State write says; no reason restated', () => {
  const step6 = step(6);
  assert.match(step6, /`autonomous`[^\n]*Gate 3 stop[^\n]*beside `gate`[^\n]*State write/);
  for (const restated of [/`stop: open`/, /`stop: risk-high`/, /drop(s|ping)? `stop`/]) {
    assert.doesNotMatch(step6, restated, `restates the reference: ${restated}`);
  }
  assert.match(step6, /Done when [^\n]*`stop`/);
});

test('plan step 7: under autonomous a stopped Gate 3 reports its reasons and resumes through wayfinder', () => {
  const step7 = step(7);
  assert.match(step7, /`Gate 3 passed: policy autonomous, nothing open`/);
  assert.match(step7, /stopped[^\n]*reasons[^\n]*`\/forge-sdlc:wayfinder <slug>`/);
  assert.match(step7, /stopped[^\n]*changes the breakdown[^\n]*`\/forge-sdlc:plan <slug>`/, 'a settlement that changes the breakdown reruns plan first');
});

test('plan Gate 3 stop: open has a reader on resume: build step 1 stops on an open: line in plan.md\'s ## Quiz', () => {
  const build1 = stepOf(readFileSync(path.join(repo, 'plugins', 'forge-sdlc', 'skills', 'build', 'SKILL.md'), 'utf8'), 1);
  assert.notEqual(build1, '', 'build has a step 1');
  assert.match(build1, /plan\.md[^\n]*`## Quiz`[^\n]*`open:`|`open:`[^\n]*plan\.md[^\n]*`## Quiz`/);
  assert.match(build1, /`open:`[^\n]*verbatim[^\n]*stop/, 'prints each open: line verbatim and stops');
  assert.match(build1, /Done when [^\n]*no `open:` line/);
});

test('PLAN-TEMPLATE.md: ## Quiz after ## Prefactoring, four recommended lines, no author instruction in it', () => {
  assert.match(template, /^## Quiz$/m);
  assert.ok(template.indexOf('## Quiz') > template.indexOf('## Prefactoring'), '## Quiz comes after ## Prefactoring');
  const quiz = template.slice(template.indexOf('## Quiz') + '## Quiz'.length).split('\n').filter((l) => l.trim());
  assert.equal(quiz.length, 4, 'only the four lines, nothing that would leak into plan.md');
  QUIZ.forEach((q, k) => assert.ok(quiz[k].startsWith(`- recommended: ${q}: `), q));
  for (const l of quiz) assert.match(l, /\(source: policy autonomous\)$/);
});

test('plan steps 1, 5 and 6: a policy-passed Gate 2, the Quiz block in plan.md and the PR body', () => {
  assert.match(step(1), /policy[^\n]*Gate 2|Gate 2[^\n]*policy/);
  assert.match(step(5), /`## Quiz`[^\n]*after `## Prefactoring`[^\n]*`autonomous` only/);
  assert.match(step(6), /`## Plan`[^\n]*Quiz[^\n]*under the slice table|under the slice table[^\n]*Quiz/);
});

test('contracts: the PR body ## Plan row notes the Quiz lines under autonomous; the stop bullet\'s open reason covers plan.md', () => {
  const contracts = readFileSync(path.join(repo, 'docs', 'contracts.md'), 'utf8');
  const row = contracts.split('\n').find((l) => l.startsWith('| `## Plan` |'));
  assert.ok(row, 'a ## Plan row');
  assert.match(row, /Quiz lines[^|]*`autonomous`[^|]*`risk: normal`/);
  const stop = contracts.split('\n').find((l) => l.startsWith('- `stop` is optional'));
  assert.match(stop, /`open` \([^)]*plan\.md\)/);
});

test('the gate policy reference: the open reason covers plan.md, the artifact Gate 3 checks', () => {
  const ref = readFileSync(path.join(dir, '..', 'wayfinder', 'GATE-POLICY.md'), 'utf8');
  const row = ref.split('\n').find((l) => l.startsWith('| `open` |'));
  assert.match(row, /`plan\.md`/);
});
