// The band's mark (hooks/run-pane/mark.ts): forge unless the host config's
// `## Mark` names its own. Node strips the module's types on import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { FORGE_MARK, parseMark } = await import('../plugins/forge-sdlc/hooks/run-pane/mark.ts');
const config = (mark) => ({ 'proof-commands': { test: 'node --test' }, ...(mark ? { mark } : {}) });

test('no config or no section draws forge', () => {
  assert.deepEqual(parseMark(undefined), { parts: FORGE_MARK, problems: [] });
  assert.deepEqual(parseMark(config()), { parts: FORGE_MARK, problems: [] });
  assert.deepEqual(FORGE_MARK, [{ text: 'forge' }]);
});

test('a text, with or without a colour, is the mark; text none is no mark', () => {
  assert.deepEqual(parseMark(config({ text: ' iZi ' })).parts, [{ text: 'iZi' }]);
  assert.deepEqual(parseMark(config({ text: 'iZi', color: '#8b5cf6' })).parts, [{ text: 'iZi', color: '#8b5cf6' }]);
  assert.deepEqual(parseMark(config({ text: 'NONE', color: 'red' })), { parts: [], problems: [] });
});

test('a section without a text keeps forge and says why', () => {
  for (const bad of [{}, { color: 'red' }, { text: '  ' }])
    assert.deepEqual(parseMark(config(bad)), {
      parts: FORGE_MARK,
      problems: ['mark ignored: ## Mark needs a `text` bullet (a word, or none)'],
    });
});
