// bin/crew-name.mjs at its process boundary: the line it prints, its exit code and the state it
// writes, over fixture hosts with forge.md and state.json written per case, against the shipped
// crew.json (docs/contracts.md, "Member name").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { readState, writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { forgeMd, host } from './support/host.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'bin', 'crew-name.mjs');

/** A forge.md with the Branches section and these `## Crew` bullets; no bullets is no `## Crew`. */
const withCrew = (lines) => (lines ? `${forgeMd()}\n## Crew\n${lines.join('\n')}\n` : forgeMd());

/** A host with `crew` bullets and an effort `demo` in state holding `slices`; `{ dir }`. */
function crewHost(crew, { slices = {} } = {}) {
  const { dir } = host({ config: withCrew(crew) });
  writeState(dir, { efforts: { demo: { stage: 'build', gate: 'none', slices, updatedAt: '2026-10-17T10:00:00Z' } } });
  return { dir };
}

const name = (dir, role, ...extra) => spawnSync(process.execPath, [script, role, '--project', dir, '--effort', 'demo', ...extra], { encoding: 'utf8', timeout: 10_000 });
const effort = (dir) => readState(dir).efforts.demo;
const stateText = (dir) => readFileSync(path.join(dir, '.forge', 'state.json'), 'utf8');

/** The printed name: exit 0, one line, in handle form (letters, digits, `_`, `-`). */
function printed(r) {
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^[A-Za-z0-9_-]+\n$/, 'one line in handle form');
  return r.stdout.trim();
}

test('a preset theme prints the role\'s first name and records it; a second call prints the next', () => {
  const { dir } = crewHost(['- theme: star-trek']);
  assert.equal(printed(name(dir, 'implementer')), 'Scotty');
  assert.deepEqual(effort(dir).crew, { implementer: ['Scotty'] });
  assert.equal(printed(name(dir, 'implementer')), 'OBrien');
  assert.deepEqual(effort(dir).crew, { implementer: ['Scotty', 'OBrien'] });
});

test('a pool run out restarts with -2, then -3', () => {
  const { dir } = crewHost(['- theme: star-trek']);
  const names = Array.from({ length: 7 }, () => printed(name(dir, 'verifier')));
  assert.deepEqual(names, ['Data', 'Tuvok', 'TPol', 'Data-2', 'Tuvok-2', 'TPol-2', 'Data-3']);
  assert.deepEqual(effort(dir).crew.verifier, names);
});

test('--slice picks a name and writes it as the slice\'s member; the same slice again prints it and records nothing new', () => {
  const { dir } = crewHost(['- theme: star-trek'], { slices: { 'demo-01': { status: 'building', mode: 'normal' } } });
  assert.equal(printed(name(dir, 'implementer', '--slice', 'demo-01')), 'Scotty');
  assert.deepEqual(effort(dir).slices['demo-01'], { status: 'building', mode: 'normal', member: 'Scotty' });
  assert.deepEqual(effort(dir).crew.implementer, ['Scotty']);
  const before = stateText(dir);
  assert.equal(printed(name(dir, 'implementer', '--slice', 'demo-01')), 'Scotty');
  assert.equal(stateText(dir), before);
  assert.equal(printed(name(dir, 'implementer', '--slice', 'demo-02')), 'OBrien', 'another slice takes the next name');
  assert.equal(effort(dir).slices['demo-02'].member, 'OBrien');
});

test('a names.<role> override replaces that role\'s pool and leaves the others on the preset', () => {
  const { dir } = crewHost(['- theme: star-trek', "- names.implementer: Seven of Nine, Miles O'Brien"]);
  assert.equal(printed(name(dir, 'implementer')), 'Seven-of-Nine');
  assert.equal(printed(name(dir, 'implementer')), 'Miles-OBrien');
  assert.equal(printed(name(dir, 'implementer')), 'Seven-of-Nine-2');
  assert.equal(printed(name(dir, 'verifier')), 'Data');
});

test('a free-text theme uses its names bullets, and a role it does not name falls back to <role>', () => {
  const { dir } = crewHost(['- theme: Discworld', '- names.implementer: Rincewind, Twoflower', '- names.verifier: Granny Weatherwax']);
  assert.equal(printed(name(dir, 'implementer', '--slice', 'demo-01')), 'Rincewind');
  assert.equal(printed(name(dir, 'verifier')), 'Granny-Weatherwax');
  assert.equal(printed(name(dir, 'reviewer')), 'reviewer');
  assert.equal(printed(name(dir, 'reviewer')), 'reviewer-2');
});

for (const [label, crew] of [['no ## Crew', null], ['theme: none', ['- theme: none']]]) {
  test(`${label}: an implementer with --slice is <slug>-<nn>, two verifier calls are verifier then verifier-2`, () => {
    const { dir } = crewHost(crew, { slices: { 'demo-01': { status: 'building' } } });
    assert.equal(printed(name(dir, 'implementer', '--slice', 'demo-01')), 'demo-01');
    assert.equal(effort(dir).slices['demo-01'].member, 'demo-01');
    assert.equal(printed(name(dir, 'implementer', '--slice', 'demo-01')), 'demo-01');
    assert.equal(printed(name(dir, 'verifier')), 'verifier');
    assert.equal(printed(name(dir, 'verifier')), 'verifier-2');
    assert.equal(printed(name(dir, 'implementer')), 'implementer', 'an implementer without --slice is <role>');
    assert.deepEqual(effort(dir).crew, { implementer: ['demo-01', 'implementer'], verifier: ['verifier', 'verifier-2'] });
  });
}

test('handle form: diacritics folded, spaces to -, other characters dropped; a name left empty is skipped', () => {
  const { dir } = crewHost(['- names.general: Padmé Amidala, Bowser Jr., Professor E. Gadd, - Kes -, !!!, 日本']);
  const names = Array.from({ length: 5 }, () => printed(name(dir, 'general')));
  assert.deepEqual(names, ['Padme-Amidala', 'Bowser-Jr', 'Professor-E-Gadd', 'Kes', 'Padme-Amidala-2']);
});

test('an override with no name left in handle form counts as none: the preset, else <role>', () => {
  const { dir } = crewHost(['- theme: star-trek', '- names.reviewer: !!!, 日本']);
  assert.equal(printed(name(dir, 'reviewer')), 'Spock');
  const free = crewHost(['- theme: Discworld', '- names.reviewer: !!!, 日本']);
  assert.equal(printed(name(free.dir, 'reviewer')), 'reviewer');
});

test('an effort absent from state prints a name and leaves the state file unchanged', () => {
  const { dir } = crewHost(['- theme: star-trek']);
  const before = stateText(dir);
  const r = spawnSync(process.execPath, [script, 'implementer', '--project', dir, '--effort', 'other', '--slice', 'other-01'], { encoding: 'utf8' });
  assert.equal(printed(r), 'Scotty');
  assert.equal(stateText(dir), before);
  const bare = host({ config: withCrew(['- theme: star-trek']) });
  assert.equal(printed(name(bare.dir, 'verifier')), 'Data', 'no state file at all');
  assert.equal(existsSync(path.join(bare.dir, '.forge', 'state.json')), false);
});

test('an unknown role, a missing or unknown flag, or --slice off an implementer exits 2 and records nothing', () => {
  const { dir } = crewHost(['- theme: star-trek']);
  const before = stateText(dir);
  const run = (args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  for (const args of [
    ['captain', '--project', dir, '--effort', 'demo'],
    ['--project', dir, '--effort', 'demo'],
    ['verifier', '--effort', 'demo'],
    ['verifier', '--project', dir],
    ['verifier', '--project', dir, '--effort'],
    ['implementer', '--project', dir, '--effort', 'demo', '--slice'],
    ['verifier', '--project', dir, '--effort', 'demo', '--slot', 'x'],
    ['verifier', '--project', dir, '--effort', 'demo', '--slice', 'demo-01'],
  ]) {
    const r = run(args);
    assert.equal(r.status, 2, `${args.join(' ')}: ${r.stderr}`);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /usage: crew-name\.mjs/);
  }
  assert.equal(stateText(dir), before);
});

test('every shipped preset pool prints each of its names once, in handle form, before restarting with -2', async () => {
  const presets = JSON.parse(readFileSync(path.join(path.dirname(script), '..', 'crew.json'), 'utf8')).presets;
  const run = promisify(execFile);
  const next = async (dir, role) => printed({ status: 0, ...(await run(process.execPath, [script, role, '--project', dir, '--effort', 'demo'])) });
  // One host per preset, run side by side; within a host the calls stay in order, as they share its state.
  await Promise.all(Object.entries(presets).map(async ([id, preset]) => {
    const { dir } = crewHost([`- theme: ${id}`]);
    for (const [role, pool] of Object.entries(preset.names)) {
      const names = [];
      for (let i = 0; i < pool.length; i += 1) names.push(await next(dir, role));
      assert.equal(new Set(names).size, pool.length, `${id}.${role}: two names share a handle`);
      assert.equal(await next(dir, role), `${names[0]}-2`, `${id}.${role}`);
    }
  }));
});
