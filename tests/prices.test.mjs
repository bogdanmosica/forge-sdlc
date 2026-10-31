// The shipped price table (plugins/forge-sdlc/prices.json). The run pane's USD is a
// list-price estimate from it; this holds the file to its shape: dated, sourced,
// USD per million tokens, and a price for every model a role's agent file names
// (hooks/run-pane/prices.ts matches ids up to a date suffix).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc');
const prices = JSON.parse(readFileSync(path.join(root, 'prices.json'), 'utf8'));
const bare = (id) => id.replace(/-\d{8}$/, '');

test('prices.json is dated, sourced and in USD per million tokens', () => {
  assert.match(prices.date, /^\d{4}-\d{2}-\d{2}$/, 'date is an ISO day');
  assert.ok(prices.source && prices.source.length > 10, 'source names where the prices came from');
  assert.equal(prices.unit, 'USD per million tokens');
});

test('every model has the four positive rates, cache write at 1.25 x input', () => {
  for (const [model, p] of Object.entries(prices.models)) {
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite'])
      assert.ok(p[k] > 0, `${model}.${k} is a positive number`);
    assert.ok(p.cacheRead < p.input, `${model}: a cache read is cheaper than input`);
    assert.equal(p.cacheWrite, p.input * 1.25, `${model}: cache write is the 5-minute rate`);
  }
});

test('every model a role names in agents/ is priced', () => {
  const priced = new Set(Object.keys(prices.models).map(bare));
  for (const file of readdirSync(path.join(root, 'agents')).filter((f) => f.endsWith('.md'))) {
    const m = readFileSync(path.join(root, 'agents', file), 'utf8').match(/^model:\s*(\S+)/m);
    assert.ok(m, `${file} names a model`);
    assert.ok(priced.has(bare(m[1])), `${m[1]} is priced`);
  }
});
