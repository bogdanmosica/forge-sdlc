// The forge.md reader: sections, bullets, comments, lists and the branch rules derived from them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { block, branchRules, effortOf, globOfShape, listOf, parseForgeConfig, readState, writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { forgeMd, host } from './support/host.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');

test('parses sections and bullets, drops trailing comments and backticks, keeps colons inside values', () => {
  const config = parseForgeConfig(`# forge-sdlc host config

## Proof commands
- test: \`pnpm test --run\`
- typecheck: pnpm tsc --noEmit   # slow
- url: http://localhost:3000

## Branches
- default: main
- protected: main, release/*
`);
  assert.deepEqual(config['proof-commands'], {
    test: 'pnpm test --run',
    typecheck: 'pnpm tsc --noEmit',
    url: 'http://localhost:3000',
  });
  assert.deepEqual(config.branches, { default: 'main', protected: 'main, release/*' });
});

test('listOf splits comma lists; globOfShape turns <placeholders> into *', () => {
  assert.deepEqual(listOf('main, release/*,  hotfix/* '), ['main', 'release/*', 'hotfix/*']);
  assert.deepEqual(listOf(undefined), []);
  assert.equal(globOfShape('feat/<slug>'), 'feat/*');
  assert.equal(globOfShape('slice/<slug>-<nn>'), 'slice/*-*');
});

test('branchRules: config wins, protected is the default plus the list without duplicates', () => {
  const { dir } = host({ branch: 'main', config: forgeMd(['- protected: main, release/*', '- effort: feat/<slug>']) });
  const rules = branchRules(parseForgeConfig(forgeMd(['- protected: main, release/*'])), dir);
  assert.equal(rules.configured, true);
  assert.equal(rules.defaultBranch, 'main');
  assert.deepEqual(rules.protected, ['main', 'release/*']);
  assert.equal(rules.effort, 'feat/*');
  assert.equal(rules.slice, 'slice/*-*');
});

test('branchRules without config detects the default branch from the repo', () => {
  const { dir } = host({ branch: 'feat/x', config: null });
  const rules = branchRules(null, dir);
  assert.equal(rules.configured, false);
  assert.deepEqual(rules.protected, ['main']);
});

test('bin/forge-config.mjs prints the config with rules, and fails loud on a host without one', () => {
  const { dir } = host({ branch: 'main' });
  const ok = spawnSync(process.execPath, [path.join(root, 'bin', 'forge-config.mjs'), dir], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  const printed = JSON.parse(ok.stdout);
  assert.equal(printed.gates.spec, 'always');
  assert.equal(printed.rules.effort, 'feat/*');
  const bare = host({ branch: 'main', config: null });
  const missing = spawnSync(process.execPath, [path.join(root, 'bin', 'forge-config.mjs'), bare.dir], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /forge-sdlc:init/);
});

const repoRoot = path.resolve(root, '..', '..');
const printConfig = (dir) => {
  const r = spawnSync(process.execPath, [path.join(root, 'bin', 'forge-config.mjs'), dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};

test("bin/forge-config.mjs prints this repo's crew theme as crew.theme", () => {
  assert.equal(printConfig(repoRoot).crew?.theme, 'star-trek');
});

test("bin/forge-config.mjs prints this repo's gate policy as gates.policy attended", () => {
  assert.equal(printConfig(repoRoot).gates?.policy, 'attended');
});

const template = readFileSync(path.join(root, 'skills', 'init', 'FORGE-TEMPLATE.md'), 'utf8');

test('bin/forge-config.mjs prints crew.theme none for a host written from the init template', () => {
  const { dir } = host({ branch: 'main', config: template });
  assert.deepEqual(printConfig(dir).crew, { theme: 'none' });
});

test('bin/forge-config.mjs prints gates.policy attended for a host written from the init template', () => {
  const { dir } = host({ branch: 'main', config: template });
  assert.equal(printConfig(dir).gates.policy, 'attended');
});

test("bin/forge-config.mjs prints a names.<role> bullet under crew, the names in display form", () => {
  const withNames = template.replace(/^- theme: .*$/m, "- theme: deep space\n- names.implementer: Miles O'Brien, Seven of Nine, Rom, Nog, Quark");
  const { dir } = host({ branch: 'main', config: withNames });
  assert.deepEqual(printConfig(dir).crew, {
    theme: 'deep space',
    'names.implementer': "Miles O'Brien, Seven of Nine, Rom, Nog, Quark",
  });
});

test('docs/contracts.md: the state shape has crew per effort, member and agent per slice, and the Names rows for crew-name.mjs and crew.json', () => {
  const contracts = readFileSync(path.join(repoRoot, 'docs', 'contracts.md'), 'utf8');
  const shape = /## `\.forge\/state\.json`[\s\S]*?```json\n([\s\S]*?)```/.exec(contracts)[1];
  assert.match(shape, /"crew": \{ "<role>": \[/);
  assert.match(shape, /"<slug>-01": \{[^\n]*"member": [^\n]*"agent": /);
  const names = /## Names\n([\s\S]*?)\n## /.exec(contracts)[1];
  assert.match(names, /^\| Member name \|[^\n]*bin\/crew-name\.mjs/m);
  assert.match(names, /^\| Crew presets \|[^\n]*crew\.json/m);
});

test('docs/contracts.md: the effort record has the optional stop, and the effort-position row prints policy and stop', () => {
  const contracts = readFileSync(path.join(repoRoot, 'docs', 'contracts.md'), 'utf8');
  const shape = /## `\.forge\/state\.json`[\s\S]*?```json\n([\s\S]*?)```/.exec(contracts)[1];
  assert.match(shape, /"gate": [^\n]*\n\s*"stop": "open \| flagged \| risk-high"/, 'stop beside gate');
  const state = /## `\.forge\/state\.json`\n([\s\S]*?)\n## /.exec(contracts)[1];
  assert.match(state, /^- `stop`[^\n]*additive[^\n]*absent[^\n]*none/m, 'stop is additive, absent reads as none');
  const names = /## Names\n([\s\S]*?)\n## /.exec(contracts)[1];
  assert.match(names, /^\| Effort position \|[^\n]*\{ slug, stage, gate, next, why, source, policy, stop \}/m);
});

test('state: null before any effort, round-trips through an atomic write, effortOf reads one effort', () => {
  const { dir } = host();
  assert.equal(readState(dir), null);
  writeState(dir, { efforts: { checkout: { stage: 'intent', gate: 'intent', mode: 'normal', risk: 'normal', branch: 'feat/checkout', pr: null, slices: {} } } });
  const state = readState(dir);
  assert.equal(state.version, 1);
  assert.equal(effortOf(state, 'checkout').gate, 'intent');
  assert.equal(effortOf(state, 'nope'), null);
  assert.equal(effortOf(null, 'checkout'), null);
  assert.ok(!existsSync(path.join(dir, '.forge', `state.json.${process.pid}.tmp`)), 'temp file renamed away');
  writeFileSync(path.join(dir, '.forge', 'state.json'), '{not json');
  assert.throws(() => readState(dir), /state\.json/);
});

test('block is the Stop decision shape', () => {
  assert.deepEqual(block('run the proof'), { decision: 'block', reason: 'run the proof' });
});
