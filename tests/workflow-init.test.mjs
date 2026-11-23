// Init writes the workflow knobs to docs/agents/forge.yaml under `workflow:`: the Gates
// question, the Write step's forge.yaml bullet, the forge.md template without `## Gates`, and
// the frame evals' fixture host (evals/lib/host.sh), whose roster now carries `workflow:`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRoster } from '../plugins/forge-sdlc/hooks/roster.mjs';
import { parseForgeConfig } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const skillDir = path.join(root, 'skills', 'init');
const skill = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
const template = readFileSync(path.join(skillDir, 'FORGE-TEMPLATE.md'), 'utf8');

test('init: the forge.md template has no ## Gates and none of its bullets', () => {
  assert.doesNotMatch(template, /^## Gates/m);
  for (const key of ['policy', 'spec', 'max_parallel_slices']) assert.doesNotMatch(template, new RegExp(`^- ${key}:`, 'm'), `no stray ${key} bullet`);
});

const { body } = (() => {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(skill);
  assert.ok(m, 'frontmatter block');
  return { body: m[2] };
})();

/** The Gates question: from its numbered item to the Risk globs question. */
const gates = () => {
  const m = /^\d+\. \*\*Gates\*\*[\s\S]*?(?=^\d+\. \*\*Risk globs\*\*)/m.exec(body);
  assert.ok(m, 'a numbered **Gates** question under Ask, before Risk globs');
  return m[0];
};

test('init/SKILL.md: the Gates question asks the policy, then under attended whether Gate 2 passes by policy, then max_parallel_slices', () => {
  const q = gates();
  const policy = q.indexOf('`Policy: attended or autonomous?`');
  assert.ok(policy > 0, 'asks `Policy: attended or autonomous?`');
  assert.match(q, /[Ll]ead with `attended`/, 'leads with attended');
  const gate2 = q.search(/[Uu]nder `attended`[^\n]*Gate 2[^\n]*by policy/);
  assert.ok(gate2 > policy, 'under attended, Gate 2 by policy is asked after the policy');
  const parallel = q.indexOf('`max_parallel_slices`', gate2);
  assert.ok(parallel > gate2, 'max_parallel_slices asked last');
  assert.match(q.slice(parallel), /[Ll]ead with 3/);
  assert.doesNotMatch(q.replace(/^.*re-run.*$/gm, ''), /only-on-open|`always`/, 'the deprecated spec values are not offered, only read on a re-run');
});

test('init/SKILL.md: the Gates answers go under workflow: in docs/agents/forge.yaml, never to forge.md', () => {
  const q = gates();
  assert.match(q, /`workflow:`[^\n]*`docs\/agents\/forge\.yaml`/);
  assert.match(q, /never to forge\.md/);
});

test('init/SKILL.md: a re-run leads with the current workflow: values, else the ## Gates bullets', () => {
  assert.match(gates(), /re-run leads with the current `workflow:` values[^\n]*else[^\n]*`## Gates` bullets?/);
});

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

test('init/SKILL.md: Write puts workflow.policy and workflow.max_parallel_slices always, workflow.gates.spec: policy only when chosen', () => {
  const bullet = rosterBullet();
  assert.match(bullet, /`workflow\.policy` and `workflow\.max_parallel_slices` always/);
  assert.match(bullet, /`workflow\.gates\.spec: policy` only when chosen/);
});

test('init/SKILL.md: the forge.yaml example reads back with its workflow knobs from forge.yaml and no problems', () => {
  const m = /```yaml\n([\s\S]*?)\n\s*```/.exec(rosterBullet());
  assert.ok(m, 'a yaml example in the forge.yaml bullet');
  const roster = resolveRoster(m[1].replace(/^ {2}/gm, ''), undefined);
  assert.deepEqual(roster.problems, []);
  const { workflow } = roster;
  assert.equal(workflow.policy, 'attended');
  assert.equal(workflow.maxParallelSlices, 3);
  assert.equal(workflow.gates.spec, 'policy');
  assert.equal(workflow.sources.policy, 'workflow.policy in forge.yaml');
  assert.equal(workflow.sources.maxParallelSlices, 'workflow.max_parallel_slices in forge.yaml');
  assert.equal(workflow.sources.spec, 'gates.spec in forge.yaml');
});

test('init/SKILL.md: an existing forge.yaml keeps every other key, gates.intent and gates.plan included, and gains workflow: when missing', () => {
  const bullet = rosterBullet();
  assert.match(bullet, /rewrite only `slots\.policy` and the `workflow:` keys/);
  assert.match(bullet, /keep every other key/);
  for (const key of ['version', 'enforce', 'roles', 'allow', 'gates.intent', 'gates.plan']) assert.match(bullet, new RegExp(`\`${key.replace('.', '\\.')}\``), `names ${key} as kept`);
  assert.match(bullet, /add[^\n]*`workflow:`[^\n]*missing/);
});

test('init/SKILL.md: a re-run drops forge.md ## Gates, since the template no longer has it', () => {
  assert.match(section('Write'), /re-run[^\n]*`## Gates`[^\n]*drops it/);
});
