// The shipped crew presets, structurally: the five prior-sdlc themes, the eight forge pools in
// each, the pool sizes, and no two names of a pool that collapse to one handle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(repo, 'plugins', 'forge-sdlc', 'crew.json');
const presets = () => JSON.parse(readFileSync(file, 'utf8')).presets;

const LABELS = {
  warcraft: 'Warcraft',
  'star-trek': 'Star Trek',
  'star-wars': 'Star Wars',
  got: 'Game of Thrones',
  mario: 'Super Mario',
};
const ROLES = ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger', 'general'];

test('crew.json holds exactly the five presets, each with its label and the eight forge pools', () => {
  const all = presets();
  assert.deepEqual(Object.keys(all).sort(), Object.keys(LABELS).sort());
  for (const [id, preset] of Object.entries(all)) {
    assert.equal(preset.label, LABELS[id], id);
    assert.deepEqual(Object.keys(preset.names).sort(), [...ROLES].sort(), id);
    for (const role of ROLES) {
      for (const name of preset.names[role]) assert.ok(typeof name === 'string' && name.trim(), `${id}.${role}`);
    }
  }
});
