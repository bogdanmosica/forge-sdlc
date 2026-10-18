// The plugin's manifests agree with its files: every registered hook script exists, the
// marketplace names this plugin, the dependency is the official Pocock plugin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(repo, 'plugins', 'forge-sdlc');
const json = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

test('plugin.json: name, version, and the official mattpocock-skills dependency', () => {
  const plugin = json('.claude-plugin/plugin.json');
  assert.equal(plugin.name, 'forge-sdlc');
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(plugin.dependencies, ['mattpocock-skills@claude-plugins-official']);
});

test('marketplace.json at the repository root lists forge-sdlc under plugins/', () => {
  const market = JSON.parse(readFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(market.name, 'forge-personal');
  const entry = market.plugins.find((p) => p.name === 'forge-sdlc');
  assert.ok(entry);
  assert.equal(entry.source, './plugins/forge-sdlc');
  assert.ok(existsSync(path.join(repo, entry.source, '.claude-plugin', 'plugin.json')));
});

test('marketplace.json allowlists claude-plugins-official, so the dependency installs across marketplaces', () => {
  // The engine skips a dependency from another marketplace unless the root marketplace names it
  // (ADR 0015); the install then succeeds without mattpocock-skills and the plugin fails to load.
  const market = JSON.parse(readFileSync(path.join(repo, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const plugin = json('.claude-plugin/plugin.json');
  const foreign = plugin.dependencies.map((d) => d.split('@')[1]).filter((m) => m && m !== market.name);
  for (const m of foreign) assert.ok(market.allowCrossMarketplaceDependenciesOn?.includes(m), m);
});

test('hooks.json: every script it names exists, every hook is exec-form with a timeout', () => {
  const hooks = json('hooks/hooks.json').hooks;
  const scripts = new Set();
  for (const event of Object.values(hooks)) {
    for (const group of event) {
      for (const h of group.hooks) {
        assert.equal(h.type, 'command');
        assert.equal(h.command, 'node');
        assert.ok(h.timeout > 0);
        const script = h.args[0].replace('${CLAUDE_PLUGIN_ROOT}/', '');
        assert.ok(existsSync(path.join(root, script)), script);
        scripts.add(path.basename(script));
      }
    }
  }
  const onDisk = readdirSync(path.join(root, 'hooks', 'scripts')).filter((f) => f.endsWith('.mjs') && f !== 'lib.mjs');
  assert.deepEqual([...scripts].sort(), onDisk.sort());
});

test('every skill folder has a SKILL.md with a name matching its folder', () => {
  const skills = path.join(root, 'skills');
  for (const name of readdirSync(skills)) {
    const file = path.join(skills, name, 'SKILL.md');
    assert.ok(existsSync(file), file);
    const text = readFileSync(file, 'utf8');
    assert.match(text, new RegExp(`^name: ${name}$`, 'm'));
    assert.match(text, /^disable-model-invocation: true$/m);
  }
});
