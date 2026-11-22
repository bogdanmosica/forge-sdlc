// bin/roster.mjs at its process boundary: the line it prints for a slot, the JSON roster with its
// problems, and its exit code, over fixture hosts with forge.md and forge.yaml written per case
// (docs/efforts/roster-as-code/spec.md, `bin/roster.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { forgeMd, host } from './support/host.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'bin', 'roster.mjs');

/** A host with this forge.md (default: Branches and Gates only) and, when given, this forge.yaml text. */
function rosterHost({ config = forgeMd(), yaml } = {}) {
  const { dir } = host({ config });
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  return { dir };
}

const roster = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10_000 });

/** The one line printed for `slot` in `dir`, exit 0. */
function line(dir, slot) {
  const r = roster(slot, '--project', dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^[^\n]+\n$/, 'one line');
  return r.stdout.trim();
}

test('without forge.yaml each slot prints its default skill and policy prints none', () => {
  const { dir } = rosterHost();
  assert.equal(line(dir, 'implementer.tdd'), 'mattpocock-skills:tdd');
  assert.equal(line(dir, 'prototyper.prototype'), 'mattpocock-skills:prototype');
  assert.equal(line(dir, 'grilling'), 'mattpocock-skills:grilling');
  assert.equal(line(dir, 'spec-writer.codebase-design'), 'mattpocock-skills:codebase-design');
  assert.equal(line(dir, 'domain-modeling'), 'mattpocock-skills:domain-modeling');
  assert.equal(line(dir, 'policy'), 'none');
});

test('a forge.yaml slot prints its skill, an optional slot disabled prints disabled, and policy prints its names comma-separated', () => {
  const { dir } = rosterHost({
    yaml: [
      'version: 1',
      'slots:',
      '  implementer.tdd: other-plugin:tdd',
      '  domain-modeling: disabled',
      '  policy: [writing-for-agents, my-plugin:security]',
      '',
    ].join('\n'),
  });
  assert.equal(line(dir, 'implementer.tdd'), 'other-plugin:tdd');
  assert.equal(line(dir, 'domain-modeling'), 'disabled');
  assert.equal(line(dir, 'grilling'), 'mattpocock-skills:grilling');
  assert.equal(line(dir, 'policy'), 'writing-for-agents,my-plugin:security');
});

test('an empty policy list prints none, even over a ## Policy skills value', () => {
  const config = `${forgeMd()}\n## Policy skills\n- skills: writing-for-agents\n`;
  assert.equal(line(rosterHost({ config }).dir, 'policy'), 'writing-for-agents', 'without forge.yaml the deprecated section still applies');
  assert.equal(line(rosterHost({ config, yaml: 'version: 1\nslots:\n  policy: []\n' }).dir, 'policy'), 'none');
});

/** The JSON roster printed for `dir`, exit 0. */
function json(dir) {
  const r = roster('--project', dir);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('the JSON form carries the resolved roster and every problem', () => {
  const { dir } = rosterHost({
    yaml: [
      'version: 1',
      'roles:',
      '  reviewer:',
      '    agent: my-plugin:reviewer',
      '    effort: medium',
      'slots:',
      '  grilling: disabled',
      '  spec-writer.codebase-design: disabled',
      '',
    ].join('\n'),
  });
  const r = json(dir);
  assert.equal(r.present, true);
  assert.equal(r.enforce, 'off');
  assert.deepEqual(r.roles.reviewer, { agent: 'my-plugin:reviewer', effort: 'medium', swapped: true });
  assert.deepEqual(r.roles.implementer, { agent: 'forge-sdlc:implementer', swapped: false });
  assert.equal(r.slots.grilling, 'mattpocock-skills:grilling', 'a required slot keeps its default');
  assert.equal(r.slots['spec-writer.codebase-design'], 'disabled');
  assert.deepEqual(r.problems, ['roster: slots.grilling is required and cannot be disabled; mattpocock-skills:grilling kept']);
});

test('the JSON form without forge.yaml is the defaults with no problems', () => {
  const r = json(rosterHost().dir);
  assert.equal(r.present, false);
  assert.equal(r.enforce, 'off');
  assert.deepEqual(r.policy, []);
  assert.deepEqual(r.problems, []);
  assert.equal(r.roles.merger.agent, 'forge-sdlc:merger');
  assert.equal(r.slots['implementer.tdd'], 'mattpocock-skills:tdd');
});

test('exit 2 with the usage on stderr and nothing on stdout for an unknown slot, a missing --project, or extra words', () => {
  const { dir } = rosterHost();
  for (const args of [['tdd', '--project', dir], ['implementer.tdd'], [], ['grilling', 'policy', '--project', dir], ['grilling', '--project']]) {
    const r = roster(...args);
    assert.equal(r.status, 2, `exit 2 for ${JSON.stringify(args)}`);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^usage: roster\.mjs .*--project <host>/);
    assert.match(r.stderr, /implementer\.tdd, prototyper\.prototype, grilling, spec-writer\.codebase-design, domain-modeling, policy/);
  }
});
