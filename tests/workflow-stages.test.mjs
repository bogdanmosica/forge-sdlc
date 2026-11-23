// The gate policy and the stages that read their gate from the workflow: GATE-POLICY.md states the
// rule once (each gate's mode, source and stops from bin/workflow.mjs --gate), wayfinder, spec and
// plan point to it with their own gate key, artifact and next command, build reads
// max_parallel_slices from bin/workflow.mjs (docs/efforts/workflow-as-code/spec.md, "The gate policy
// reference" and "The stages").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { host } from './support/host.mjs';
import { stepOf } from './support/skill.mjs';

const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const read = (rel) => readFileSync(path.join(plugin, rel), 'utf8');
const policy = read('skills/wayfinder/GATE-POLICY.md');

/** The body of a GATE-POLICY.md section, `## <heading>` up to the next `## `. */
const sectionOf = (text, heading) => new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(text)?.[1] ?? '';

/** The source bin/workflow.mjs --gate <key> prints on a fixture host with this forge.md and forge.yaml. */
function gateOf(key, { config = ['# forge-sdlc host config', '', '## Branches', '- default: main', ''].join('\n'), yaml } = {}) {
  const { dir } = host({ config });
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  const r = spawnSync(process.execPath, [path.join(plugin, 'bin', 'workflow.mjs'), '--gate', key, '--project', dir], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

/* GATE-POLICY.md */

test('GATE-POLICY.md: each gate is read once per run from bin/workflow.mjs --gate <key>, never from state', () => {
  assert.match(policy, /node "\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/workflow\.mjs" --gate <key>/);
  assert.match(policy, /once per run, never from state/);
  assert.match(policy, /`\{ key, n, mode, source, stops \}`/);
  for (const key of ['intent', 'spec', 'plan']) assert.ok(policy.includes(`\`${key}\``), `names the gate key ${key}`);
  assert.doesNotMatch(policy, /forge-config\.mjs/, 'the policy is no longer read from forge-config');
});

test('GATE-POLICY.md: mode policy passes on a clear stop rule, mode attended stops for the owner', () => {
  const rule = sectionOf(policy, 'The stop rule');
  assert.match(rule, /mode `policy` passes[^\n]*all three hold/);
  assert.match(rule, /no `open:` line/);
  assert.match(rule, /other than `- none`/);
  assert.match(rule, /`risk: normal`/);
  assert.match(rule, /mode `attended` stops for the owner/);
  assert.match(rule, /Gate 4[^\n]*always stops/);
  assert.match(rule, /`risk: high`[^\n]*runs attended[^\n]*whatever/);
});

test('GATE-POLICY.md: the closed set of stop reasons in write order, attended last, plan.md named for open', () => {
  const rows = sectionOf(policy, 'Stop reasons').split('\n').filter((l) => /^\| `[a-z-]+` \|/.test(l));
  assert.deepEqual(rows.map((l) => /^\| `([a-z-]+)`/.exec(l)[1]), ['open', 'flagged', 'risk-high', 'attended']);
  assert.match(rows[0], /`intent\.md`, `spec\.md` or `plan\.md`/);
  assert.match(rows[3], /mode is `attended`[^|]*forge\.yaml/);
  assert.match(policy, /first in that order[^\n]*written[^\n]*names all of them/);
});

test('GATE-POLICY.md: the state write covers attended from forge.yaml; attended from ## Gates or the default writes no stop', () => {
  const write = sectionOf(policy, 'State write');
  assert.match(write, /`stop: <reason>` beside `gate`/);
  assert.match(write, /`attended`[^\n]*forge\.yaml/);
  assert.match(write, /`## Gates` or `default`[^\n]*writes no `stop`/);
  assert.match(write, /every other stage state write drops `stop`/i);
  assert.match(write, /Gate 4 writes none/);
});

test('GATE-POLICY.md: the report line keeps its prefix and suffix, its middle the tail of the gate source', () => {
  const report = sectionOf(policy, 'Report line');
  assert.match(report, /^`Gate <n> passed: <tail>, nothing open`$/m);
  const tails = Object.fromEntries(
    report.split('\n').filter((l) => /^\| `[^`]+`.*\| `[^`]+` \|$/.test(l)).slice(1).map((l) => {
      const [, sources, tail] = /^\| (.+) \| `([^`]+)` \|$/.exec(l);
      return [tail, [...sources.matchAll(/`([^`]+)`/g)].map((m) => m[1])];
    }),
  );
  assert.deepEqual(Object.keys(tails), ['policy autonomous', 'gates.<key> policy', 'only-on-open']);
  assert.match(report, /`\/forge-sdlc:wayfinder <slug>`/);
  assert.match(report, /runs attended from here/);
  assert.match(report, /Resume/);
});

test('GATE-POLICY.md: every source a passing gate can print has its tail in the report-line table', () => {
  const report = sectionOf(policy, 'Report line');
  const yaml = (...lines) => ['version: 1', 'workflow:', ...lines, ''].join('\n');
  const gatesMd = (...bullets) => ['# forge-sdlc host config', '', '## Branches', '- default: main', '', '## Gates', ...bullets.map((b) => `- ${b}`), ''].join('\n');
  const cases = [
    [gateOf('intent', { yaml: yaml('  policy: autonomous') }), 'policy autonomous'],
    [gateOf('plan', { config: gatesMd('policy: autonomous') }), 'policy autonomous'],
    [gateOf('spec', { yaml: yaml('  gates:', '    spec: policy') }), 'gates.<key> policy'],
    [gateOf('spec', { config: gatesMd('spec: only-on-open') }), 'only-on-open'],
  ];
  for (const [gate, tail] of cases) {
    assert.equal(gate.mode, 'policy', JSON.stringify(gate));
    const row = report.split('\n').find((l) => l.endsWith(`| \`${tail}\` |`));
    assert.ok(row, `a row for ${tail}`);
    const generic = gate.source.replace(`gates.${gate.key} `, 'gates.<key> ');
    assert.ok(row.includes(`\`${generic}\``), `${gate.source} → ${tail}`);
  }
});
