// bin/workflow.mjs --mermaid at its process boundary: Mermaid A (the prototype's look, from
// docs/research/workflow-as-code/diagram-prototype/run.mjs) drawn from the resolved workflow over
// fixture hosts, positioned from .forge/state.json under --effort, and the README's diagram held
// equal to the command on a host with no settings (docs/efforts/workflow-as-code/spec.md, Mermaid A).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeState } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';
import { host } from './support/host.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'plugins', 'forge-sdlc', 'bin', 'workflow.mjs');

/** forge.md with Branches only: no ## Gates, so the defaults hold. */
const BRANCHES_ONLY = ['# forge-sdlc host config', '', '## Branches', '- default: main', ''].join('\n');

/** A host with this forge.md (default: Branches only) and, when given, this forge.yaml text. */
function mermaidHost({ config = BRANCHES_ONLY, yaml } = {}) {
  const { dir } = host({ config });
  if (yaml !== undefined) writeFileSync(path.join(dir, 'docs', 'agents', 'forge.yaml'), yaml);
  return dir;
}

const run = (args, cwd) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 10_000 });

/** The Mermaid printed for `args` on `dir`, exit 0. */
function mermaid(dir, args = []) {
  const r = run(['--mermaid', '--project', dir, ...args], dir);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

/** The line defining node `id` (a box or a hexagon). */
const nodeLine = (out, id) => out.split('\n').find((l) => new RegExp(`^\\s*${id}(\\[|\\{\\{)`).test(l));
/** The line of the edge leaving gate `id`. */
const passEdge = (out, id) => out.split('\n').find((l) => new RegExp(`^\\s*${id} (-->|==>)`).test(l));

test('on a host with no settings: flowchart TD, a box per stage with its roles and models, a hexagon per gate, every gate passed on a thick edge', () => {
  const out = mermaid(mermaidHost());
  assert.match(out, /^(%%.*\n)*flowchart TD\n/);
  for (const stage of ['map', 'intent', 'spec', 'plan', 'build', 'built']) assert.ok(nodeLine(out, stage), `a box for ${stage}`);
  assert.match(nodeLine(out, 'map'), /^\s*map\["1 · map<br\/>the map and its tickets, worked with the owner<br\/>researcher · sonnet<br\/>prototyper · opus"\]$/);
  assert.match(nodeLine(out, 'build'), /implementer · opus<br\/>verifier · sonnet<br\/>reviewer · opus<br\/>merger · sonnet"\]$/);
  assert.equal(nodeLine(out, 'G1').trim(), 'G1{{"Gate 1 · attended · default"}}:::gattended');
  assert.equal(nodeLine(out, 'G4').trim(), 'G4{{"Gate 4 · owner"}}:::gowner');
  assert.match(out, /^\s*intent --> G1$/m);
  assert.equal(passEdge(out, 'G1').trim(), 'G1 ==>|"you pass it"| spec');
  assert.equal(passEdge(out, 'G3').trim(), 'G3 ==>|"you pass it"| build');
  assert.equal(passEdge(out, 'G4').trim(), 'G4 ==>|"code owner reviews, merges"| built');
  assert.doesNotMatch(out, /:::(passed|current|stopped)\b/, 'unpositioned: no position classes on any node');
});
