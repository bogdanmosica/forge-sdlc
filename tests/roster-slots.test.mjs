// The slot rule and its call sites (docs/efforts/roster-as-code/spec.md, "The slot rule" and
// "Role-contract reference"): ROLES.md beside MEMBERS.md holds each role's contract and the one
// `## Slots` rule; each self-resolving call site is one line naming its slot, its default skill
// and the roster command, and points at the rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROLES, SLOT_NAMES, resolveRoster } from '../plugins/forge-sdlc/hooks/roster.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const read = (rel) => readFileSync(path.join(plugin, rel), 'utf8');
const ROLES_FILE = 'skills/build/ROLES.md';
const DEFAULTS = resolveRoster(undefined, undefined).slots;

/** The body of `## <name>` in `text`, up to the next `## ` heading. */
function section(text, name) {
  const lines = text.split('\n');
  const start = lines.indexOf(`## ${name}`);
  if (start < 0) return undefined;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

test('ROLES.md sits beside MEMBERS.md', () => {
  assert.ok(existsSync(path.join(plugin, 'skills/build/MEMBERS.md')));
  assert.ok(existsSync(path.join(plugin, ROLES_FILE)));
});

for (const role of ROLES) {
  test(`ROLES.md: ${role} has its inputs, report, evidence and hooks`, () => {
    const body = section(read(ROLES_FILE), role);
    assert.ok(body, `## ${role} heading, so ROLES.md#${role} resolves`);
    for (const label of ['Inputs', 'Report', 'Evidence', 'Hooks']) assert.match(body, new RegExp(`\\*\\*${label}\\.\\*\\*`), label);
    assert.match(body, new RegExp(`forge-sdlc:${role}\\b`), 'names the default agent');
  });
}

test('ROLES.md: the hooks named are the plugin hooks that exist', () => {
  const text = read(ROLES_FILE);
  for (const hook of ['verified-before-stop', 'test-frozen', 'context-budget']) {
    assert.ok(existsSync(path.join(plugin, 'hooks/scripts', `${hook}.mjs`)), hook);
    assert.match(text, new RegExp(`\`${hook}\``), hook);
  }
});

test('ROLES.md: the implementer leaves its verify record and slice agent, the merger its review record', () => {
  const text = read(ROLES_FILE);
  assert.match(section(text, 'implementer'), /\.forge\/verify\/<slug>-<nn>\.json/);
  assert.match(section(text, 'implementer'), /`agent`/);
  assert.match(section(text, 'merger'), /\.forge\/review\/<slug>-<nn>\.md/);
});

test('ROLES.md: ## Slots states the rule once: run the roster command, call what it prints, skip on disabled', () => {
  const slots = section(read(ROLES_FILE), 'Slots');
  assert.ok(slots, '## Slots heading');
  assert.match(slots, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/roster\.mjs" <slot> --project <host>/);
  assert.match(slots, /call the skill it prints/i);
  assert.match(slots, /skip[^\n]*`disabled`/i);
  assert.match(slots, /Done when/, 'the step keeps its own completion criterion');
});

test('ROLES.md: ## Slots lists every slot with its default skill', () => {
  const slots = section(read(ROLES_FILE), 'Slots');
  for (const slot of SLOT_NAMES) {
    const row = slots.split('\n').find((l) => l.startsWith(`| \`${slot}\``));
    assert.ok(row, `a row for ${slot}`);
    if (slot !== 'policy') assert.ok(row.includes(`\`${DEFAULTS[slot]}\``), `${slot} default ${DEFAULTS[slot]}`);
  }
});

/** The call sites a member or session resolves itself: [file, slot]. */
const CALL_SITES = [
  ['agents/implementer.md', 'implementer.tdd'],
  ['agents/prototyper.md', 'prototyper.prototype'],
  ['skills/wayfinder/SKILL.md', 'grilling'],
  ['skills/wayfinder/SKILL.md', 'domain-modeling'],
  ['skills/intent/SKILL.md', 'grilling'],
  ['skills/intent/SKILL.md', 'domain-modeling'],
];

for (const [file, slot] of CALL_SITES) {
  test(`${file}: one line names the ${slot} slot, its default skill, the roster command and the rule`, () => {
    const command = `bin/roster.mjs" ${slot} --project`;
    const line = read(file)
      .split('\n')
      .find((l) => l.includes(`\`${slot}\` slot`) && l.includes(command));
    assert.ok(line, `a line naming the \`${slot}\` slot and running ${command}`);
    assert.ok(line.includes(`\`${DEFAULTS[slot]}\``), `default ${DEFAULTS[slot]}`);
    assert.match(line, /ROLES\.md/, 'points at the slot rule');
  });
}

test('wayfinder: the grilling ticket row calls the slot skills step 2 resolved', () => {
  const row = read('skills/wayfinder/SKILL.md')
    .split('\n')
    .find((l) => l.startsWith('| `wayfinder:grilling`'));
  assert.ok(row);
  assert.match(row, /`grilling`[^|]*`domain-modeling`/);
  assert.match(row, /step 2/);
});
