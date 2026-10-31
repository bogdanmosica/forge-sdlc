// The band's agents with a crew theme (hooks/run-pane/crew.ts): parseCrew reads the
// host's `## Crew` section against the shipped crew.json, and agentsText names the
// running crew, else says the crew is idle. The mod's handle form agrees with
// bin/crew-name.mjs's. Node strips the module's types on import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleOf as scriptHandleOf } from '../plugins/forge-sdlc/bin/crew-name.mjs';

const { agentsText, handleOf, nameAt, parseCrew } = await import('../plugins/forge-sdlc/hooks/run-pane/crew.ts');

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRESETS = readFileSync(path.join(repo, 'plugins', 'forge-sdlc', 'crew.json'), 'utf8');

const crew = (section) => ({ crew: section });
const agent = (type, description, status = 'running') => ({ id: description, type, description, status });
const snapshot = (agents, crewLabel) => ({ usage: null, agents, readAt: 0, ...(crewLabel ? { crew: crewLabel } : {}) });
const TREK = { label: 'Star Trek' };

test("a preset's pools come from crew.json by id or label; a free-text theme names itself; none names nothing", () => {
  const trek = parseCrew(crew({ theme: 'star-trek' }), PRESETS);
  assert.equal(trek.label, 'Star Trek');
  assert.deepEqual(trek.pools.implementer, ['Scotty', "O'Brien", 'Rom', 'Barclay', 'Tom Paris']);
  assert.equal(parseCrew(crew({ theme: 'Game of Thrones' }), PRESETS).pools.merger[0], 'Tywin Lannister');
  const own = parseCrew(crew({ theme: 'Lord of the Rings', 'names.merger': 'Gandalf, Elrond' }), PRESETS);
  assert.deepEqual(own, { pools: { merger: ['Gandalf', 'Elrond'] }, problems: [], label: 'Lord of the Rings' });
  assert.deepEqual(parseCrew(crew({ theme: 'none' }), PRESETS), { pools: {}, problems: [] });
  assert.deepEqual(parseCrew(undefined, PRESETS), { pools: {}, problems: [] });
});

test("a names.<role> bullet overrides that role's preset pool and leaves the others", () => {
  const c = parseCrew(crew({ theme: 'mario', 'names.merger': 'Toadsworth' }), PRESETS);
  assert.deepEqual(c.pools.merger, ['Toadsworth']);
  assert.deepEqual(c.pools.implementer, ['Mario', 'Yoshi', 'Donkey Kong', 'Diddy Kong', 'Birdo']);
});

test('an unknown theme with no names is one problem line', () => {
  assert.deepEqual(parseCrew(crew({ theme: 'stargate' }), PRESETS), {
    pools: {},
    problems: ['crew ignored: theme "stargate" is no preset and no names.<role> bullet is set'],
  });
});

test('a pool run out starts again with a number', () => {
  assert.equal(nameAt(['Riker', 'Chakotay'], 0), 'Riker');
  assert.equal(nameAt(['Riker', 'Chakotay'], 2), 'Riker 2');
  assert.equal(nameAt(['Riker', 'Chakotay'], 5), 'Chakotay 3');
});

test('with a theme the running crew is named, whatever its type', () => {
  const agents = [
    agent('forge-sdlc:merger', 'Riker · merge slice 01'),
    agent('implementer', 'Scotty · slice 02'),
    agent('general-purpose', 'Nog · find the fixtures'),
    agent('forge-sdlc:merger', 'Riker 2 · merge slice 00', 'completed'),
  ];
  assert.equal(agentsText(snapshot(agents, TREK)), 'Riker, Scotty, Nog running');
});

test('other running agents, their descriptions carrying no crew name, are counted after the crew', () => {
  const agents = [agent('forge-sdlc:merger', 'Riker · merge slice 01'), agent('Explore', 'find the fixtures')];
  assert.equal(agentsText(snapshot(agents, TREK)), 'Riker +1 running');
});

test('with a theme and no one running the crew is idle; only other agents running are counted', () => {
  assert.equal(agentsText(snapshot([agent('forge-sdlc:merger', 'Riker · x', 'completed')], TREK)), 'Star Trek crew idle');
  assert.equal(agentsText(snapshot([agent('Explore', 'find')], TREK)), '1 agent running');
});

test('without a theme the band counts the running agents', () => {
  assert.equal(agentsText(snapshot([], undefined)), '0 agents running');
  assert.equal(agentsText(snapshot([agent('forge-sdlc:merger', 'merge slice 01')], undefined)), '1 agent running');
});

test("handleOf turns a crew name into the Agent tool's name, as bin/crew-name.mjs does", () => {
  assert.equal(handleOf('Seven of Nine'), 'Seven-of-Nine');
  assert.equal(handleOf("O'Brien"), 'OBrien');
  assert.equal(handleOf('Padmé Amidala'), 'Padme-Amidala');
  assert.equal(handleOf('Bowser Jr.'), 'Bowser-Jr');
  assert.equal(handleOf('Professor E. Gadd'), 'Professor-E-Gadd');
  assert.equal(handleOf('Riker 2'), 'Riker-2');
  assert.equal(handleOf("'!"), undefined);
  assert.equal(handleOf('x'.repeat(80)).length, 64);
  // every shipped name takes the same handle under both, so a mod-named agent and a
  // member named by the script never differ in form
  for (const preset of Object.values(JSON.parse(PRESETS).presets))
    for (const names of Object.values(preset.names))
      for (const name of names) assert.equal(handleOf(name), scriptHandleOf(name), name);
});
