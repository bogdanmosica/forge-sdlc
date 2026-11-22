// The roster's documentation (spec roster-as-code, "Docs" and "Version"): the plugin version
// that ships the roster, the ADR and design Decision behind the second host config file, the
// one CLAUDE.md clause, and the references an owner reads before writing docs/agents/forge.yaml.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(repo, 'plugins', 'forge-sdlc');
const read = (...parts) => readFileSync(path.join(...parts), 'utf8');

test('plugin.json: 0.8.0, a minor for a new host file and hook, with the roster in its description', () => {
  const manifest = JSON.parse(read(plugin, '.claude-plugin', 'plugin.json'));
  assert.equal(manifest.version, '0.8.0');
  assert.match(manifest.description, /roster[^.]*docs\/agents\/forge\.yaml/);
});
