// The init skill and its template: the Crew question with its presets and the free-text rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const skillDir = path.join(root, 'skills', 'init');
const read = (file) => readFileSync(file, 'utf8');

const skill = read(path.join(skillDir, 'SKILL.md'));
const template = read(path.join(skillDir, 'FORGE-TEMPLATE.md'));

/** `{ frontmatter, body }` of a markdown file with a YAML frontmatter block. */
const split = (text) => {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, 'frontmatter block');
  return { frontmatter: m[1], body: m[2] };
};

const { body } = split(skill);
/** The Crew question: from its numbered item to the next `## ` heading. */
const crew = () => {
  const m = /^\d+\. \*\*Crew\*\*[\s\S]*?(?=^## )/m.exec(body);
  assert.ok(m, 'a numbered **Crew** question under Ask');
  return m[0];
};

const PRESETS = [
  ['Warcraft', 'warcraft'],
  ['Star Trek', 'star-trek'],
  ['Star Wars', 'star-wars'],
  ['Game of Thrones', 'got'],
  ['Super Mario', 'mario'],
];
const ROLES = ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger', 'general'];

test('init/SKILL.md: the Crew question comes right after Policy skills, the last one asked', () => {
  const policy = body.search(/^\d+\. \*\*Policy skills\*\*/m);
  const question = body.search(/^\d+\. \*\*Crew\*\*/m);
  assert.ok(policy > 0, 'Policy skills question');
  assert.ok(question > policy, 'Crew after Policy skills');
  assert.equal(Number(/^(\d+)\. \*\*Crew\*\*/m.exec(body)[1]), Number(/^(\d+)\. \*\*Policy skills\*\*/m.exec(body)[1]) + 1);
  assert.ok(!/^\d+\. \*\*/m.test(crew().split('\n').slice(1).join('\n')), 'no question after Crew');
});

test('init/SKILL.md: the Crew question, header Crew, with None, A preset and My own theme', () => {
  const q = crew();
  assert.match(q, /header `Crew`/);
  assert.match(q, /`Crew theme: which theme names the agents while they run\?`/);
  assert.match(q, /`None`[^\n]*`none`/, 'None maps to none');
  assert.match(q, /`A preset`/);
  assert.match(q, /`My own theme`/);
  assert.match(q, /re-run[^\n]*current theme/i, 'a re-run leads with the current theme');
});

test('init/SKILL.md: A preset pages through the five presets, each mapped to its id', () => {
  const q = crew();
  assert.match(q, /`Warcraft`, `Star Trek`, `Star Wars`, `More presets`/, 'first page');
  assert.match(q, /`More presets`[^\n]*`Game of Thrones`, `Super Mario`/, 'second page after More presets');
  for (const [label, id] of PRESETS) assert.match(q, new RegExp(`\`${label}\` to \`${id}\``), `${label} maps to ${id}`);
});

test('init/SKILL.md: free text naming a preset maps to its id; any other writes names.<role> for all eight roles', () => {
  const q = crew();
  assert.match(q, /[Ff]ree text[^\n]*names a preset[^\n]*any case[^\n]*its id/);
  assert.match(q, /`names\.<role>`/);
  for (const role of ROLES) assert.match(q, new RegExp(`\`${role}\``), `role ${role}`);
  assert.match(q, /at least five[^\n]*`implementer`/);
  assert.match(q, /three[^\n]*every other role/);
});

test('init: the template carries ## Crew with theme none, and Write keeps hand-written names bullets', () => {
  assert.match(template, /^## Crew\n- theme: none\b/m);
  assert.match(body, /`names\.<role>`[^\n]*kept/, 'a re-run keeps names bullets while the theme stays');
});
