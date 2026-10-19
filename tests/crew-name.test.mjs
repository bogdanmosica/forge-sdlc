// bin/crew-name.mjs at its process boundary: the line it prints, its exit code and the state it
// writes, over fixture hosts with forge.md and state.json written per case, against the shipped
// crew.json (docs/contracts.md, "Member name").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const name = (dir, role, ...extra) => spawnSync(process.execPath, [script, role, '--project', dir, '--effort', 'demo', ...extra], { encoding: 'utf8' });
const effort = (dir) => readState(dir).efforts.demo;

/** The printed name: exit 0, one line. */
function printed(r) {
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^[^\n]+\n$/, 'one line');
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
