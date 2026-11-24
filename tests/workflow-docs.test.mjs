// The workflow's documentation (spec workflow-as-code, "Docs and version"): ADR 0026 and its
// design Decision line, the deprecation window restated, the README's workflow: schema, the
// GLOSSARY and CLAUDE.md lines, this repository's own forge.yaml, and the plugin version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(repo, 'plugins', 'forge-sdlc');
const read = (...parts) => readFileSync(path.join(...parts), 'utf8');

const ADR = 'adr/0026-the-loop-declared-tuned-per-gate.md';

test('ADR 0026 records the descriptive workflow file, the per-gate override, the attended stop and the moved deprecation window', () => {
  const file = path.join(repo, 'docs', ADR);
  assert.ok(existsSync(file), ADR);
  const adr = readFileSync(file, 'utf8');
  assert.match(adr, /^# 26\. /m);
  assert.match(adr, /^Status: accepted, \d{4}-\d{2}-\d{2}; supersedes ADR 0018 in part/m);
  for (const heading of ['Context', 'Decision', 'Consequences']) assert.match(adr, new RegExp(`^## ${heading}$`, 'm'), heading);
  assert.match(adr, /plugins\/forge-sdlc\/workflow\.yaml/, 'the plugin describes its loop');
  assert.match(adr, /descriptive/, 'a host cannot reorder, add or remove stages');
  assert.match(adr, /gates\.<key>/, 'the per-gate override');
  assert.match(adr, /`attended`[^\n]*stop reason|stop reason[^\n]*`attended`/, 'the attended stop reason');
  assert.match(adr, /bin\/workflow\.mjs/, 'the one command that resolves it');
  assert.match(adr, /## Routing[^\n]*## Policy skills[^\n]*## Gates[^\n]*removed together in the next minor/, 'the three deprecated sections go together');
  assert.match(adr, /0\.10\.0/, 'names the next minor');
});

test('docs/design.md section 8: a Decision line for the workflow links ADR 0026; the forge.md example has no ## Gates, the forge.yaml example a workflow:', () => {
  const design = read(repo, 'docs', 'design.md');
  const config = /^## 8\. Host configuration\n([\s\S]*?)^## 9\. /m.exec(design)[1];
  const decision = config.split('\n').find((l) => l.startsWith('Decision (workflow)'));
  assert.ok(decision, 'Decision (workflow) line in section 8');
  assert.match(decision, /workflow\.yaml/);
  assert.match(decision, /gates\.<key>/);
  assert.match(decision, new RegExp(`\\]\\(${ADR.replace(/[.]/g, '\\.')}\\)`), 'links the ADR');
  assert.doesNotMatch(config, /^## Gates$/m, 'init no longer writes ## Gates into forge.md');
  assert.match(config, /^workflow:[^\n]*\n {2}policy: /m, 'the forge.yaml example holds workflow:');
});

test('hooks/ROUTING.md lists ## Gates among the deprecated sections and restates their removal to the next minor', () => {
  const doc = read(plugin, 'hooks', 'ROUTING.md');
  const deprecated = doc.split(/^## Deprecated$/m)[1].split(/^## /m)[0];
  assert.match(deprecated, /## Routing[^\n]*## Policy skills[^\n]*## Gates|## Gates[^\n]*## Routing/, 'all three named');
  assert.match(deprecated, /0\.10\.0/, 'removed together in the next minor');
  assert.doesNotMatch(deprecated, /until 0\.9\.0, which removes them/, 'the old promise is gone');
  // the reader's own words, so the reference quotes what the band shows
  assert.match(deprecated, /## Gates: policy is deprecated; move it to workflow\.policy in docs\/agents\/forge\.yaml/);
  assert.match(deprecated, /## Gates: spec only-on-open is deprecated; move it to workflow\.gates\.spec: policy in docs\/agents\/forge\.yaml/);
  assert.match(deprecated, /## Gates: spec always is deprecated and has no docs\/agents\/forge\.yaml equivalent; Gate 2 follows workflow\.policy/);
  assert.match(deprecated, /ADR 0026|0026-the-loop-declared/, 'links the ADR that moved the window');
});

test('ADR 0025 restates its removal promise: the deprecated sections go in 0.10.0', () => {
  const adr = read(repo, 'docs', 'adr', '0025-the-roster-in-forge-yaml.md');
  assert.doesNotMatch(adr, /removed in 0\.9\.0/);
  assert.match(adr, /removed in 0\.10\.0[^\n]*ADR 0026/);
});
