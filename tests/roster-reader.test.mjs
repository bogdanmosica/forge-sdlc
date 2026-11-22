// The shared roster reader (plugins/forge-sdlc/hooks/roster.mjs): the strict
// YAML subset of docs/agents/forge.yaml and the resolved roster every consumer
// reads (lib.mjs, bin/roster.mjs, roster-guard.mjs, the run pane mod, the help
// panel). Fixture texts inline; expected values come from the spec's schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseYamlSubset, resolveRoster } from '../plugins/forge-sdlc/hooks/roster.mjs';

const yaml = (...lines) => lines.join('\n');

const ROLES = ['researcher', 'prototyper', 'spec-writer', 'implementer', 'verifier', 'reviewer', 'merger'];
const DEFAULT_ROLES = Object.fromEntries(ROLES.map((r) => [r, { agent: `forge-sdlc:${r}`, swapped: false }]));
const DEFAULT_SLOTS = {
  'implementer.tdd': 'mattpocock-skills:tdd',
  'prototyper.prototype': 'mattpocock-skills:prototype',
  grilling: 'mattpocock-skills:grilling',
  'spec-writer.codebase-design': 'mattpocock-skills:codebase-design',
  'domain-modeling': 'mattpocock-skills:domain-modeling',
};

test('without forge.yaml or forge.md the roster is exactly today’s defaults', () => {
  assert.deepEqual(resolveRoster(undefined, undefined), {
    present: false,
    version: null,
    enforce: 'off',
    roles: DEFAULT_ROLES,
    slots: DEFAULT_SLOTS,
    policy: [],
    allow: { agents: [], skills: [] },
    problems: [],
  });
});

test('the subset reads 2-space maps, scalar lists, plain and quoted scalars, booleans, integers, null and comments', () => {
  const text = yaml(
    '# the roster',
    'version: 1                 # required',
    'enforce: false',
    '',
    'roles:',
    '  reviewer:',
    '    agent: my-plugin:reviewer',
    "    model: 'claude-sonnet-5-5[1m]'",
    '    effort: "medium"',
    'slots:',
    '  implementer.tdd: other-plugin:tdd',
    '  policy: [writing-for-agents, "a, b", \'it\'\'s\']',
    'allow:',
    '  agents:',
    '    - Explore',
    '    - "general-purpose"   # a built-in',
    '  skills: []',
    'list-at-key-indent:',
    '- one',
    '- 2',
    'nothing:',
    'tilde: ~',
    'word-null: null',
    'yes: true',
    'negative: -3',
    'hash: a#b',
    'escaped: "say \\"hi\\" \\\\ bye"',
    'url: http://x.y/z',
  );
  assert.deepEqual(parseYamlSubset(text), {
    value: {
      version: 1,
      enforce: false,
      roles: { reviewer: { agent: 'my-plugin:reviewer', model: 'claude-sonnet-5-5[1m]', effort: 'medium' } },
      slots: { 'implementer.tdd': 'other-plugin:tdd', policy: ['writing-for-agents', 'a, b', "it's"] },
      allow: { agents: ['Explore', 'general-purpose'], skills: [] },
      'list-at-key-indent': ['one', 2],
      nothing: null,
      tilde: null,
      'word-null': null,
      yes: true,
      negative: -3,
      hash: 'a#b',
      escaped: 'say "hi" \\ bye',
      url: 'http://x.y/z',
    },
    errors: [],
  });
});

test('an empty or comment-only text is null with no errors', () => {
  assert.deepEqual(parseYamlSubset(''), { value: null, errors: [] });
  assert.deepEqual(parseYamlSubset('# nothing\n\n'), { value: null, errors: [] });
});

// Each unsupported construct, on line 2 of a two-line text whose first line is good.
const REJECTED = {
  anchor: 'b: &x 1',
  alias: 'b: *x',
  tag: 'b: !!str 1',
  'merge key': '<<: *x',
  'literal block scalar': 'b: |',
  'folded block scalar': 'b: >-',
  'multi-line flow list': 'b: [one,',
  'flow map': 'b: {c: 1}',
  'document marker': '---',
  'document end marker': '...',
  tab: '\tb: 1',
  'tab after a key': 'b:\t1',
  'duplicate key': 'a: 2',
  'odd indent': ' b: 1',
  'list of maps': 'b:\n- c: 1',
  'nested list': 'b:\n  - - c',
  'unclosed quote': 'b: "one',
  'plain value with ": "': 'b: c: d',
  'text that is no key': 'just words',
  'escape other than \\" and \\\\': 'b: "one\\ntwo"',
  'reserved indicator': 'b: @x',
};

for (const [name, line2] of Object.entries(REJECTED)) {
  test(`the subset rejects ${name} with its line`, () => {
    const { errors } = parseYamlSubset(`a: 1\n${line2}`);
    const lineOf = name === 'list of maps' || name === 'nested list' ? 3 : 2;
    assert.equal(errors.length, 1, JSON.stringify(errors));
    assert.equal(errors[0].line, lineOf);
    assert.match(errors[0].message, /\S/);
  });
}

test('a rejected line is skipped and the rest of the text is still read', () => {
  const { value, errors } = parseYamlSubset(yaml('a: 1', 'b: &x 2', 'c:', '  d: !tag 3', '  e: 4', 'f: 5'));
  assert.deepEqual(value, { a: 1, c: { e: 4 }, f: 5 });
  assert.deepEqual(
    errors.map((e) => e.line),
    [2, 4],
  );
});

test('a duplicate key keeps the first value', () => {
  assert.deepEqual(parseYamlSubset('a: 1\na: 2').value, { a: 1 });
});

test('the parser never throws, whatever the input', () => {
  for (const input of [undefined, null, 42, {}, '\0', ':', '- ', '[', '"', "'", 'a: [b, [c]]', 'a:\n    b: 1'])
    assert.doesNotThrow(() => parseYamlSubset(/** @type {any} */ (input)));
  assert.equal(parseYamlSubset('a: [b, [c]]').errors.length, 1);
  assert.equal(parseYamlSubset('a:\n    b: 1').errors[0]?.line, 2);
});
