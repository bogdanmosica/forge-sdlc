// bin/workflow.mjs at its process boundary: the resolved workflow as JSON with its problems, one
// gate's { key, n, mode, source, stops } under --gate, and its exit code, over fixture hosts with
// forge.md and forge.yaml written per case (docs/efforts/workflow-as-code/spec.md, `bin/workflow.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { host } from './support/host.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const script = path.join(plugin, 'bin', 'workflow.mjs');

/** forge.md with Branches only: no deprecated section, so no deprecation line. */
const BRANCHES_ONLY = ['# forge-sdlc host config', '', '## Branches', '- default: main', ''].join('\n');

/** A host with this forge.md (default: Branches only) and, when given, this forge.yaml text. */
function workflowHost({ config = BRANCHES_ONLY, yaml } = {}) {
  const { dir } = host({ config });
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  return { dir };
}

const workflow = (args, cwd) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 10_000 });

/** The JSON printed for `args`, exit 0. */
function json(args, cwd) {
  const r = workflow(args, cwd);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

/** The model line of a plugin agent's frontmatter. */
const frontmatterModel = (name) => /^model:\s*(\S+)/m.exec(readFileSync(path.join(plugin, 'agents', `${name}.md`), 'utf8'))?.[1];

const gatesOf = (wf) => Object.fromEntries(wf.stages.filter((s) => s.gate).map((s) => [s.gate.key, { mode: s.gate.mode, source: s.gate.source }]));

test('without forge.yaml the JSON is the plugin loop: six stages, every gate attended by default, Gate 4 the owner\'s, no problems', () => {
  const { dir } = workflowHost();
  const wf = json(['--project', dir]);
  assert.deepEqual(wf.stages.map((s) => s.name), ['map', 'intent', 'spec', 'plan', 'build', 'built']);
  assert.equal(wf.policy, 'attended');
  assert.equal(wf.maxParallelSlices, 3);
  assert.equal(wf.effort, null);
  assert.deepEqual(wf.problems, []);
  assert.deepEqual(gatesOf(wf), {
    intent: { mode: 'attended', source: 'default' },
    spec: { mode: 'attended', source: 'default' },
    plan: { mode: 'attended', source: 'default' },
    pr: { mode: 'owner', source: 'always' },
  });
});

test('each role carries its plugin agent and the model from that agent\'s frontmatter', () => {
  const { dir } = workflowHost();
  const wf = json(['--project', dir]);
  const roles = wf.stages.flatMap((s) => s.roles);
  assert.deepEqual(roles.map((r) => r.role), ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger']);
  for (const r of roles) {
    assert.equal(r.agent, `forge-sdlc:${r.role}`);
    assert.equal(r.swapped, false);
    assert.ok(frontmatterModel(r.role), `agents/${r.role}.md names a model`);
    assert.equal(r.model, frontmatterModel(r.role), r.role);
  }
});
