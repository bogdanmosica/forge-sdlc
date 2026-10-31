// The run pane's reading of docs/agents/forge.md (hooks/run-pane/config.ts) is the
// hooks' reading (hooks/scripts/lib.mjs parseForgeConfig): the same sections, keys
// and values for the template init writes and for the shapes a host may type.
// Node strips the module's types on import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listOf as hooksListOf, parseForgeConfig as hooksParse } from '../plugins/forge-sdlc/hooks/scripts/lib.mjs';

const { HOST_CONFIG, listOf, parseForgeConfig } = await import('../plugins/forge-sdlc/hooks/run-pane/config.ts');

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(path.join(repo, 'plugins', 'forge-sdlc', 'skills', 'init', 'FORGE-TEMPLATE.md'), 'utf8');

const SAMPLES = [
  template,
  [
    '# forge-sdlc host config',
    '',
    '## Proof commands',
    '- test: pnpm test --run   # the suite',
    '- build: none',
    '',
    '## Crew',
    '- theme: "star-trek"',
    "- names.implementer: Scotty, Miles O'Brien, Rom",
    '',
    '## Routing',
    '- model.researcher: `claude-sonnet-5-5`',
    '- effort.researcher: medium',
    '- bare line without a bullet',
    '',
    '## Mark',
    '- text: iZi',
    '- color: "#8b5cf6"', // a bare # starts a comment: a hex colour is quoted
    '',
    'a line outside every section: ignored',
  ].join('\n'),
  '',
  '- a bullet before any heading: dropped\n## Two  Words\n- k: v',
];

test('the mod reads the same config the hooks read', () => {
  assert.equal(HOST_CONFIG, path.join('docs', 'agents', 'forge.md'));
  for (const text of SAMPLES) assert.deepEqual(parseForgeConfig(text), hooksParse(text));
});

test('the sections the run pane reads come out as it expects', () => {
  const c = parseForgeConfig(SAMPLES[1]);
  assert.deepEqual(c.crew, { theme: 'star-trek', 'names.implementer': "Scotty, Miles O'Brien, Rom" });
  assert.deepEqual(c.routing, { 'model.researcher': 'claude-sonnet-5-5', 'effort.researcher': 'medium' });
  assert.deepEqual(c.mark, { text: 'iZi', color: '#8b5cf6' });
  assert.deepEqual(c['two-words'], undefined);
  assert.deepEqual(parseForgeConfig(SAMPLES[3])['two-words'], { k: 'v' });
});

test('a comma-separated value is the same list for both', () => {
  for (const v of [undefined, '', ' a , b,,c ', 'one']) assert.deepEqual(listOf(v), hooksListOf(v));
});
