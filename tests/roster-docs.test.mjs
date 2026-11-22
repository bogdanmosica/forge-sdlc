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

const ADR = 'adr/0025-the-roster-in-forge-yaml.md';

test('ADR 0025 records the roster in forge.yaml: context, decision, consequences', () => {
  const file = path.join(repo, 'docs', ADR);
  assert.ok(existsSync(file), ADR);
  const adr = readFileSync(file, 'utf8');
  assert.match(adr, /^# 25\. The roster in forge\.yaml$/m);
  assert.match(adr, /^Status: accepted, \d{4}-\d{2}-\d{2}/m);
  for (const heading of ['Context', 'Decision', 'Consequences']) assert.match(adr, new RegExp(`^## ${heading}$`, 'm'), heading);
  assert.match(adr, /`docs\/agents\/forge\.md` only/, 'names the convention it amends');
  assert.match(adr, /`agent\.spawn`/, 'roles swap at spawn');
  assert.match(adr, /bin\/roster\.mjs/, 'slots resolve through the roster command');
  assert.match(adr, /roster-guard/, 'enforcement is the guard hook');
});

test('docs/design.md section 8: a Decision line for the roster links ADR 0025', () => {
  const design = read(repo, 'docs', 'design.md');
  const config = /^## 8\. Host configuration\n([\s\S]*?)^## 9\. /m.exec(design)[1];
  const decision = config.split('\n').find((l) => l.startsWith('Decision (roster)'));
  assert.ok(decision, 'Decision (roster) line in section 8');
  assert.match(decision, /docs\/agents\/forge\.yaml/);
  assert.match(decision, new RegExp(`\\]\\(${ADR.replace(/[.]/g, '\\.')}\\)`), 'links the ADR');
  assert.doesNotMatch(config, /^## Policy skills$/m, 'init no longer writes ## Policy skills into forge.md');
});

test('docs/design.md section 6: the agent table notes frontmatter is the default the roster overrides', () => {
  const design = read(repo, 'docs', 'design.md');
  const agents = /^## 6\. The agents\n([\s\S]*?)^### Who does what/m.exec(design)[1];
  assert.match(agents, /frontmatter is the default[^\n]*roster|roster[^\n]*frontmatter is the default/);
});
