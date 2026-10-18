// Every agent file in agents/: frontmatter name matches the file, a description, a pinned
// model, an effort, and a brief that fits on one screen (docs/contracts.md, "Agents").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const agents = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'forge-sdlc', 'agents');
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'];
const EFFORTS = ['low', 'medium', 'high'];

const files = readdirSync(agents).filter((f) => f.endsWith('.md'));

test('agents/ holds at least one agent', () => {
  assert.ok(files.length > 0);
});

for (const file of files) {
  test(`${file}: frontmatter and brief`, () => {
    const text = readFileSync(path.join(agents, file), 'utf8');
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
    assert.ok(m, 'opens with YAML frontmatter');
    const fm = Object.fromEntries(
      m[1].split('\n').map((line) => /^([A-Za-z-]+):\s*(.*)$/.exec(line)).filter(Boolean).map(([, k, v]) => [k, v]),
    );
    assert.equal(fm.name, path.basename(file, '.md'), 'name matches the file');
    assert.ok(fm.description?.length >= 20, 'description present');
    assert.ok(MODELS.includes(fm.model), `model is one of ${MODELS.join(', ')}: ${fm.model}`);
    assert.ok(EFFORTS.includes(fm.effort), `effort is one of ${EFFORTS.join(', ')}: ${fm.effort}`);
    const body = m[2].trimEnd().split('\n');
    assert.ok(body.length < 60, `body under 60 lines: ${body.length}`);
  });
}
