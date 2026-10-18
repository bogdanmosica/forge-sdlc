// The intent skill (design section 5, "intent (by hand)"), tested for structure: frontmatter,
// the Destination headings, the grilling by name, no charting, the commit on feat/<slug>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installedUpstream, skillFile } from '../plugins/forge-sdlc/bin/upstream.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const skill = readFileSync(path.join(plugin, 'skills', 'intent', 'SKILL.md'), 'utf8');
const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skill)?.[1] ?? '';

test('frontmatter: name, description, user-invoked, <slug> argument', () => {
  assert.match(frontmatter, /^name: intent$/m);
  assert.match(frontmatter, /^description: .{20,}$/m);
  assert.match(frontmatter, /^disable-model-invocation: true$/m);
  assert.match(frontmatter, /^argument-hint: "<slug>"$/m);
});

test('every numbered step ends on a Done when line', () => {
  const steps = skill.split(/^## \d+\. /m).slice(1);
  assert.ok(steps.length >= 4);
  for (const step of steps) assert.match(step, /Done when [^\n]+\.\s*$/, step.split('\n')[0]);
});

test('needs the committed map, else points at wayfinder', () => {
  assert.match(skill, /docs\/efforts\/<slug>\/map\.md/);
  assert.match(skill, /feat\/<slug>/);
  assert.match(skill, /\/forge-sdlc:wayfinder/);
});

test('grills the five Destination headings through the upstream skills, the human answering', () => {
  assert.match(skill, /mattpocock-skills:grilling/);
  assert.match(skill, /mattpocock-skills:domain-modeling/);
  for (const h of ['Problem', 'Outcome', 'Users', 'Constraints', 'Open questions']) assert.match(skill, new RegExp(h), h);
  assert.match(skill, /## Destination/);
  assert.match(skill, /human answers/);
});

test('charts nothing and keeps the stage', () => {
  assert.match(skill, /charts nothing/);
  assert.match(skill, /\.forge\/state\.json/);
  assert.doesNotMatch(skill, /writeState|gh issue create|wayfinder:map/);
});

test('rewrites intent.md only while status: draft, the PR Intent section with it, then commits', () => {
  assert.match(skill, /status: draft/);
  assert.match(skill, /status: accepted/);
  assert.match(skill, /## Intent/);
  assert.match(skill, /PR\.md/);
  assert.match(skill, /intent\(<slug>\): /);
});

test('no line of the upstream grilling file is copied into the skill', (t) => {
  const upstream = installedUpstream({ env: process.env, projectDir: path.resolve(plugin, '..', '..') });
  const file = upstream && skillFile(upstream.root, 'grilling');
  if (!file) return t.skip('set MATTPOCOCK_SKILLS_ROOT to the pocock-skills root to compare against the upstream file');
  for (const line of readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l.length > 40)) {
    assert.ok(!skill.includes(line), `upstream line pasted: ${line}`);
  }
});

test('under one screen', () => {
  assert.ok(skill.split('\n').length < 60);
});
