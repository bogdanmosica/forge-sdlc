// bin/workflow.mjs at its process boundary: the resolved workflow as JSON with its problems, one
// gate's { key, n, mode, source, stops } under --gate, and its exit code, over fixture hosts with
// forge.md and forge.yaml written per case (docs/efforts/workflow-as-code/spec.md, `bin/workflow.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readHostConfig, readWorkflow, writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
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
const ROSTER_WORKFLOW = [
  'version: 1',
  'workflow:',
  '  policy: autonomous',
  '  max_parallel_slices: 5',
  '  gates:',
  '    plan: attended',
  '    pr: policy',
  '',
].join('\n');

test('with forge.yaml the JSON carries its workflow: knobs with their sources and reports a bad key among the problems', () => {
  const { dir } = workflowHost({ yaml: ROSTER_WORKFLOW });
  const wf = json(['--project', dir]);
  assert.equal(wf.policy, 'autonomous');
  assert.equal(wf.maxParallelSlices, 5);
  assert.deepEqual(gatesOf(wf), {
    intent: { mode: 'policy', source: 'workflow.policy in forge.yaml' },
    spec: { mode: 'policy', source: 'workflow.policy in forge.yaml' },
    plan: { mode: 'attended', source: 'gates.plan in forge.yaml' },
    pr: { mode: 'owner', source: 'always' },
  });
  assert.equal(wf.problems.length, 1, wf.problems.join('\n'));
  assert.match(wf.problems[0], /workflow\.gates\.pr is not a setting: Gate 4 is always the code owner/);
});

test('with forge.md ## Gates and no forge.yaml the JSON reads the deprecated bullets and names where to move each', () => {
  const config = [BRANCHES_ONLY, '## Gates', '- policy: autonomous', '- spec: only-on-open', ''].join('\n');
  const { dir } = workflowHost({ config });
  const wf = json(['--project', dir]);
  assert.equal(wf.policy, 'autonomous');
  assert.deepEqual(gatesOf(wf).spec, { mode: 'policy', source: 'spec in forge.md ## Gates' });
  assert.deepEqual(gatesOf(wf).plan, { mode: 'policy', source: 'policy in forge.md ## Gates' });
  assert.ok(wf.problems.some((p) => /## Gates: policy is deprecated; move it to workflow\.policy/.test(p)), wf.problems.join('\n'));
  assert.ok(wf.problems.some((p) => /## Gates: spec only-on-open is deprecated; move it to workflow\.gates\.spec: policy/.test(p)), wf.problems.join('\n'));
});

test('--gate prints each gate\'s key, n, mode, source and stops and nothing else', () => {
  const { dir } = workflowHost();
  const gate = (key) => json(['--gate', key, '--project', dir]);
  assert.deepEqual(gate('intent'), { key: 'intent', n: 1, mode: 'attended', source: 'default', stops: ['open', 'risk-high', 'attended'] });
  assert.deepEqual(gate('spec'), { key: 'spec', n: 2, mode: 'attended', source: 'default', stops: ['open', 'flagged', 'risk-high', 'attended'] });
  assert.deepEqual(gate('plan'), { key: 'plan', n: 3, mode: 'attended', source: 'default', stops: ['open', 'risk-high', 'attended'] });
  assert.deepEqual(gate('pr'), { key: 'pr', n: 4, mode: 'owner', source: 'always', stops: [] });
});

test('--gate plan on a gates.plan: attended host names gates.plan in forge.yaml, while the other gates pass by policy', () => {
  const { dir } = workflowHost({ yaml: ROSTER_WORKFLOW });
  assert.deepEqual(json(['--gate', 'plan', '--project', dir]), {
    key: 'plan', n: 3, mode: 'attended', source: 'gates.plan in forge.yaml', stops: ['open', 'risk-high', 'attended'],
  });
  assert.deepEqual(json(['--gate', 'intent', '--project', dir]), {
    key: 'intent', n: 1, mode: 'policy', source: 'workflow.policy in forge.yaml', stops: ['open', 'risk-high', 'attended'],
  });
  assert.equal(json(['--gate', 'pr', '--project', dir]).mode, 'owner');
});

test('--project defaults to the cwd', () => {
  const { dir } = workflowHost({ yaml: ROSTER_WORKFLOW });
  assert.equal(json(['--gate', 'plan'], dir).source, 'gates.plan in forge.yaml');
  assert.equal(json([], dir).maxParallelSlices, 5);
});

test('an unknown flag, an unknown or missing gate key, or a positional is bad usage: exit 2, usage on stderr, nothing on stdout', () => {
  const { dir } = workflowHost();
  for (const args of [['--bogus'], ['--gate', 'deploy'], ['--gate', 'build'], ['--gate'], ['plan'], ['--project']]) {
    const r = workflow(args, dir);
    assert.equal(r.status, 2, args.join(' '));
    assert.equal(r.stdout, '', args.join(' '));
    assert.match(r.stderr, /^usage: workflow\.mjs/, args.join(' '));
  }
});

test('it reads only: the host\'s tree is as the case left it', () => {
  const { dir } = workflowHost({ yaml: ROSTER_WORKFLOW });
  json(['--project', dir]);
  json(['--gate', 'spec', '--project', dir]);
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' }).stdout;
  assert.equal(status, '?? docs/agents/forge.yaml\n');
});

test('readHostConfig and forge-config.mjs still print forge.md ## Gates as written, whatever forge.yaml sets', () => {
  const config = [BRANCHES_ONLY, '## Gates', '- policy: autonomous', '- spec: only-on-open', ''].join('\n');
  const { dir } = workflowHost({ config, yaml: ['version: 1', 'workflow:', '  policy: attended', ''].join('\n') });
  assert.deepEqual(readHostConfig(dir), { branches: { default: 'main' }, gates: { policy: 'autonomous', spec: 'only-on-open' } });
  const r = spawnSync(process.execPath, [path.join(plugin, 'bin', 'forge-config.mjs'), dir], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(r.status, 0, r.stderr);
  const printed = JSON.parse(r.stdout);
  assert.deepEqual(printed.gates, { policy: 'autonomous', spec: 'only-on-open' });
  assert.equal(printed.workflow, undefined);
});
test('readWorkflow with an effort\'s slug positions the loop from its record in .forge/state.json; a slug with no record leaves it unpositioned', () => {
  const { dir } = workflowHost({ yaml: ROSTER_WORKFLOW });
  writeState(dir, { efforts: { demo: { stage: 'plan', gate: 'plan', stop: 'attended', risk: 'normal', branch: 'feat/demo' } } });
  const wf = readWorkflow(dir, 'demo');
  assert.deepEqual(wf.effort, { slug: 'demo', stage: 'plan', gate: 'plan', stop: 'attended', risk: 'normal' });
  assert.deepEqual(wf.stages.map((s) => s.status), ['passed', 'passed', 'passed', 'current', 'ahead', 'ahead']);
  assert.equal(wf.stages.find((s) => s.name === 'plan').gate.status, 'stopped');
  assert.equal(readWorkflow(dir, 'other').effort, null);
  assert.equal(readWorkflow(dir).effort, null);
});
