// Init and the roster: the policy-skills answer goes to docs/agents/forge.yaml
// (`version: 1`, `slots.policy`), an existing roster keeps every other key, and
// the forge.md template no longer carries the deprecated `## Policy skills`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRoster } from '../plugins/forge-sdlc/hooks/roster.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const skillDir = path.join(root, 'skills', 'init');
const skill = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');

/** A `## <name>` section of the skill, up to the next `## ` heading. */
const section = (name) => {
  const m = new RegExp(`^## \\d+\\. ${name}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(skill);
  assert.ok(m, `a ## ${name} section`);
  return m[1];
};

/** The Write step's forge.yaml bullet: from its `- ` line to the next top-level bullet. */
const rosterBullet = () => {
  const m = /^- [^\n]*`docs\/agents\/forge\.yaml`[\s\S]*?(?=^- |^Then )/m.exec(section('Write'));
  assert.ok(m, 'a Write bullet for docs/agents/forge.yaml');
  return m[0];
};

/** The forge.yaml example the bullet shows, as text. */
const example = () => {
  const m = /```yaml\n([\s\S]*?)\n\s*```/.exec(rosterBullet());
  assert.ok(m, 'a yaml example in the forge.yaml bullet');
  return m[1].replace(/^ {2}/gm, '');
};

test('init/SKILL.md: the Policy skills question writes its answer to forge.yaml slots.policy', () => {
  const q = /^\d+\. \*\*Policy skills\*\*[^\n]*/m.exec(section('Ask'));
  assert.ok(q, 'the Policy skills question stays');
  assert.match(q[0], /`docs\/agents\/forge\.yaml`/);
  assert.match(q[0], /`slots\.policy`/);
});

test('init/SKILL.md: Write creates forge.yaml with version 1 and slots.policy, an empty list for none', () => {
  const bullet = rosterBullet();
  assert.match(bullet, /`version: 1`/);
  assert.match(bullet, /`slots\.policy`/);
  assert.match(bullet, /`\[\]`[^\n]*none|none[^\n]*`\[\]`/, 'none is written as an empty list');
  assert.match(bullet, /[Cc]reat/, 'the file is created when absent');
});

test('init/SKILL.md: the forge.yaml example reads back as a version 1 roster with the policy skills and no problems', () => {
  const roster = resolveRoster(example(), undefined);
  assert.equal(roster.present, true);
  assert.equal(roster.version, 1);
  assert.deepEqual(roster.problems, []);
  assert.ok(roster.policy.length > 0, 'the example lists at least one policy skill');
});
