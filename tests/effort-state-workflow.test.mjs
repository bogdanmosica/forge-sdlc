// bin/effort-state.mjs over the resolved workflow (docs/efforts/workflow-as-code/spec.md, `effort-state.mjs`):
// the `gates` field with each gate's mode and source, the `attended` stop and its why, and a host with
// forge.md `## Gates` and no forge.yaml printing what it printed before apart from `gates`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { forgeMd, host } from './support/host.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'bin', 'effort-state.mjs');

/** forge.md with Branches only: no ## Gates. */
const BRANCHES_ONLY = ['# forge-sdlc host config', '', '## Branches', '- default: main', ''].join('\n');

/** A host with this forge.md (default: Branches only), this forge.yaml text when given, and these state efforts. */
function stateHost({ config = BRANCHES_ONLY, yaml, efforts = {} } = {}) {
  const { dir } = host({ config });
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  writeState(dir, { efforts });
  return dir;
}

/** The JSON effort-state.mjs prints for `args`, exit 0. */
function run(...args) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const effort = (stage, gate, extra = {}) => ({ stage, gate, mode: 'normal', risk: 'normal', branch: 'feat/x', pr: null, slices: {}, updatedAt: '2026-10-17T10:00:00Z', ...extra });

test('gates: each gate\'s mode and source, from forge.yaml over the default, Gate 4 the owner\'s', () => {
  const dir = stateHost({ yaml: 'workflow:\n  policy: autonomous\n  gates:\n    plan: attended\n', efforts: { x: effort('spec', 'spec') } });
  assert.deepEqual(run(dir, 'x').gates, {
    intent: { mode: 'policy', source: 'workflow.policy in forge.yaml' },
    spec: { mode: 'policy', source: 'workflow.policy in forge.yaml' },
    plan: { mode: 'attended', source: 'gates.plan in forge.yaml' },
    pr: { mode: 'owner', source: 'always' },
  });
});

test('stop: attended gives the why naming the forge.yaml key that makes the gate attended', () => {
  const cases = [
    ['workflow:\n  gates:\n    plan: attended\n', 'gate plan is attended in forge.yaml (gates.plan)'],
    ['workflow:\n  policy: attended\n', 'gate plan is attended in forge.yaml (workflow.policy)'],
    ['workflow:\n  policy: autonomous\n  gates:\n    plan: attended\n', 'gate plan is attended in forge.yaml (gates.plan)'],
  ];
  for (const [yaml, why] of cases) {
    const dir = stateHost({ yaml, efforts: { x: effort('plan', 'plan', { stop: 'attended' }) } });
    const r = run(dir, 'x');
    assert.deepEqual({ stop: r.stop, why: r.why, next: r.next }, { stop: 'attended', why, next: 'build' }, yaml);
  }
});

test('stop: attended reads was-attended when the current settings no longer make the gate attended', () => {
  const cases = [
    ['no forge.yaml', BRANCHES_ONLY, undefined],
    ['gates.plan now policy', BRANCHES_ONLY, 'workflow:\n  gates:\n    plan: policy\n'],
    ['workflow.policy now autonomous', BRANCHES_ONLY, 'workflow:\n  policy: autonomous\n'],
    ['attended only from ## Gates', forgeMd().replace('- spec: always', '- policy: attended'), undefined],
  ];
  for (const [name, config, yaml] of cases) {
    const dir = stateHost({ config, yaml, efforts: { x: effort('plan', 'plan', { stop: 'attended' }) } });
    const r = run(dir, 'x');
    assert.deepEqual({ stop: r.stop, why: r.why }, { stop: 'attended', why: 'gate plan was attended in forge.yaml' }, name);
  }
});

test('policy: workflow.policy in forge.yaml wins over ## Gates policy', () => {
  const config = forgeMd().replace('- spec: always', '- policy: attended');
  const dir = stateHost({ config, yaml: 'workflow:\n  policy: autonomous\n', efforts: { x: effort('spec', 'spec') } });
  assert.equal(run(dir, 'x').policy, 'autonomous');
});

test('a host with ## Gates and no forge.yaml prints what it printed before, apart from gates', () => {
  const config = forgeMd().replace('- spec: always', '- policy: autonomous\n- spec: only-on-open');
  const dir = stateHost({ config, efforts: { x: effort('spec', 'spec', { stop: 'flagged' }) } });
  const r = run(dir, 'x');
  assert.deepEqual(Object.keys(r), ['slug', 'stage', 'gate', 'next', 'why', 'source', 'policy', 'stop', 'gates']);
  const { gates, ...before } = r;
  assert.deepEqual(before, { slug: 'x', stage: 'spec', gate: 'spec', next: 'plan', why: 'a flagged concern waits for the owner', source: 'state', policy: 'autonomous', stop: 'flagged' });
  assert.deepEqual(gates, {
    intent: { mode: 'policy', source: 'policy in forge.md ## Gates' },
    spec: { mode: 'policy', source: 'spec in forge.md ## Gates' },
    plan: { mode: 'policy', source: 'policy in forge.md ## Gates' },
    pr: { mode: 'owner', source: 'always' },
  });
});

test('gates: a risk-high effort reads every gate attended by risk: high', () => {
  const dir = stateHost({ yaml: 'workflow:\n  policy: autonomous\n', efforts: { x: effort('intent', 'intent', { risk: 'high', stop: 'risk-high' }) } });
  const { gates } = run(dir, 'x');
  assert.deepEqual([gates.intent, gates.spec, gates.plan], Array(3).fill({ mode: 'attended', source: 'risk: high' }));
  assert.deepEqual(gates.pr, { mode: 'owner', source: 'always' });
});

test('--list entries carry gates and the attended why', () => {
  const dir = stateHost({ yaml: 'workflow:\n  gates:\n    plan: attended\n', efforts: { a: effort('plan', 'plan', { stop: 'attended' }), b: effort('spec', 'spec') } });
  const list = run('--list', dir);
  assert.deepEqual(list.map((e) => [e.slug, e.stop, e.why, e.gates.plan.source]), [
    ['a', 'attended', 'gate plan is attended in forge.yaml (gates.plan)', 'gates.plan in forge.yaml'],
    ['b', 'none', 'Gate 2: running this approves spec.md', 'gates.plan in forge.yaml'],
  ]);
});

test('gates without a state record: the artifacts on feat/<slug> decide the stage, gates the unpositioned resolution', () => {
  const dir = stateHost({ yaml: 'workflow:\n  policy: autonomous\n  gates:\n    plan: attended\n' });
  const git = (args) => assert.equal(spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).status, 0, args.join(' '));
  git(['switch', '-q', '-c', 'feat/x']);
  mkdirSync(path.join(dir, 'docs', 'efforts', 'x'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'efforts', 'x', 'plan.md'), '# plan\n');
  git(['add', 'docs/efforts']);
  git(['commit', '-q', '-m', 'x artifacts']);
  git(['switch', '-q', 'main']);
  const r = run(dir, 'x');
  assert.deepEqual({ source: r.source, stage: r.stage, stop: r.stop }, { source: 'artifacts', stage: 'plan', stop: 'none' });
  assert.deepEqual(r.gates, {
    intent: { mode: 'policy', source: 'workflow.policy in forge.yaml' },
    spec: { mode: 'policy', source: 'workflow.policy in forge.yaml' },
    plan: { mode: 'attended', source: 'gates.plan in forge.yaml' },
    pr: { mode: 'owner', source: 'always' },
  });
});

/** The stop union a declaration or contract lists, as an array of its quoted names in order. */
const quoted = (text) => [...text.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

test('the state contract lists the four stops, attended last: hooks/types/index.d.ts and docs/contracts.md', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const types = readFileSync(path.join(root, 'plugins', 'forge-sdlc', 'hooks', 'types', 'index.d.ts'), 'utf8');
  const union = /export type ForgeStop = ([^;]+);/.exec(types)?.[1] ?? '';
  assert.deepEqual(quoted(union), ['open', 'flagged', 'risk-high', 'attended']);
  const contracts = readFileSync(path.join(root, 'docs', 'contracts.md'), 'utf8');
  assert.match(contracts, /"stop": "open \| flagged \| risk-high \| attended"/);
  assert.match(contracts, /`stop` is the state's `stop` \(`open`, `flagged`, `risk-high`, `attended`\)/);
});
