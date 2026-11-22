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

const ROSTER = yaml(
  'version: 1',
  'enforce: true',
  'roles:',
  '  reviewer:',
  '    agent: my-plugin:reviewer',
  '    model: sonnet',
  '    effort: medium',
  '  implementer:',
  '    effort: high',
  '  merger:',
  '    agent: forge-sdlc:merger',
  'slots:',
  '  implementer.tdd: other-plugin:tdd',
  '  domain-modeling: disabled',
  '  spec-writer.codebase-design: my-design',
  '  policy: [writing-for-agents, security]',
  'allow:',
  '  agents: [Explore]',
  '  skills:',
  '    - pr',
);

test('a roster swaps roles, sets model and effort, swaps and disables slots, lists policy and allow, and enforces', () => {
  assert.deepEqual(resolveRoster(ROSTER, undefined), {
    present: true,
    version: 1,
    enforce: 'on',
    roles: {
      ...DEFAULT_ROLES,
      reviewer: { agent: 'my-plugin:reviewer', model: 'sonnet', effort: 'medium', swapped: true },
      implementer: { agent: 'forge-sdlc:implementer', effort: 'high', swapped: false },
      merger: { agent: 'forge-sdlc:merger', swapped: false },
    },
    slots: {
      ...DEFAULT_SLOTS,
      'implementer.tdd': 'other-plugin:tdd',
      'domain-modeling': 'disabled',
      'spec-writer.codebase-design': 'my-design',
    },
    policy: ['writing-for-agents', 'security'],
    allow: { agents: ['Explore'], skills: ['pr'] },
    problems: [],
  });
});

test('enforce is on only for the literal true', () => {
  const enforce = (value) => resolveRoster(`version: 1\nenforce: ${value}`, undefined).enforce;
  assert.equal(enforce('true'), 'on');
  assert.equal(enforce('false'), 'off');
  assert.equal(resolveRoster('version: 1', undefined).enforce, 'off');
});

// Each bad entry beside a good one: the bad one is skipped and reported on one
// `roster:` line naming its key, the good one still applies.
const BAD = [
  ['an unknown top-level key', 'procedures:\n  a: b', /\bprocedures\b/],
  ['an unknown role', 'roles:\n  tester:\n    agent: x', /\broles\.tester\b/],
  ['a role entry that is no map', 'roles:\n  reviewer: my-plugin:reviewer', /\broles\.reviewer\b/],
  ['an unknown role field', 'roles:\n  reviewer:\n    prompt: be nice', /\broles\.reviewer\.prompt\b/],
  ['an agent that is no type name', 'roles:\n  reviewer:\n    agent: "two words"', /\broles\.reviewer\.agent\b/],
  ['an agent that is no string', 'roles:\n  reviewer:\n    agent: 42', /\broles\.reviewer\.agent\b/],
  ['a model that is no alias or claude-* id', 'roles:\n  reviewer:\n    model: gpt-9', /\broles\.reviewer\.model\b/],
  ['an effort outside the levels', 'roles:\n  reviewer:\n    effort: huge', /\broles\.reviewer\.effort\b/],
  ['an unknown slot', 'slots:\n  review: x', /\bslots\.review\b/],
  ['a slot named like an object property', 'slots:\n  constructor: x', /\bslots\.constructor\b/],
  ['a slot value that is no skill name', 'slots:\n  grilling: [a, b]', /\bslots\.grilling\b/],
  ['slots that are no map', 'slots: grilling', /\bslots\b/],
  ['a policy that is no list', 'slots:\n  policy: writing-for-agents', /\bslots\.policy\b/],
  ['allow that is no map', 'allow: [Explore]', /\ballow\b/],
  ['an unknown allow key', 'allow:\n  tools: [Bash]', /\ballow\.tools\b/],
  ['allow.agents that is no list', 'allow:\n  agents: Explore', /\ballow\.agents\b/],
  ['an enforce that is not true or false', 'enforce: yes', /\benforce\b/],
  ['a quoted "true" enforce', 'enforce: "true"', /\benforce\b/],
];

const GOOD = 'roles:\n  verifier:\n    model: haiku';

for (const [name, entry, names] of BAD) {
  test(`${name} is skipped and reported`, () => {
    const lines = entry.split('\n');
    // the bad entry merged into the good file: same top-level key, or a new one
    const text = lines[0] === 'roles:' ? ['version: 1', 'roles:', '  verifier:', '    model: haiku', ...lines.slice(1)].join('\n') : ['version: 1', GOOD, entry].join('\n');
    const r = resolveRoster(text, undefined);
    assert.equal(r.problems.length, 1, JSON.stringify(r.problems));
    assert.match(r.problems[0], /^roster: /);
    assert.match(r.problems[0], names);
    assert.equal(r.roles.verifier.model, 'haiku', 'the good entry still applies');
    assert.deepEqual(r.roles.reviewer, DEFAULT_ROLES.reviewer);
    assert.deepEqual(r.slots, DEFAULT_SLOTS);
    assert.deepEqual(r.allow, { agents: [], skills: [] });
    assert.equal(r.enforce, 'off');
  });
}

test('roles that are no map are reported and the slots still read', () => {
  const r = resolveRoster(yaml('version: 1', 'roles: [reviewer]', 'slots:', '  domain-modeling: disabled'), undefined);
  assert.deepEqual(r.roles, DEFAULT_ROLES);
  assert.equal(r.slots['domain-modeling'], 'disabled');
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /^roster: .*\broles\b/);
});

test('a bad field leaves the rest of its role entry in force', () => {
  const r = resolveRoster(yaml('version: 1', 'roles:', '  reviewer:', '    agent: mine', '    model: gpt-9', '    effort: low'), undefined);
  assert.deepEqual(r.roles.reviewer, { agent: 'mine', effort: 'low', swapped: true });
  assert.equal(r.problems.length, 1);
});

test('a bad policy or allow item is skipped and the others kept', () => {
  const r = resolveRoster(yaml('version: 1', 'slots:', '  policy: [a, 3, b]', 'allow:', '  skills: [pr, true]'), undefined);
  assert.deepEqual(r.policy, ['a', 'b']);
  assert.deepEqual(r.allow.skills, ['pr']);
  assert.equal(r.problems.length, 2);
  assert.match(r.problems[0], /^roster: .*slots\.policy/);
  assert.match(r.problems[1], /^roster: .*allow\.skills/);
});

for (const slot of ['implementer.tdd', 'prototyper.prototype', 'grilling']) {
  test(`disabling the required slot ${slot} is reported and its default kept`, () => {
    const r = resolveRoster(`version: 1\nslots:\n  ${slot}: disabled`, undefined);
    assert.equal(r.slots[slot], DEFAULT_SLOTS[slot]);
    assert.equal(r.problems.length, 1);
    assert.match(r.problems[0], new RegExp(`^roster: .*slots\\.${slot.replace('.', '\\.')}.*required`));
  });
}

test('a missing version is reported and the file still read as version 1', () => {
  const r = resolveRoster('slots:\n  domain-modeling: disabled', undefined);
  assert.equal(r.version, null);
  assert.equal(r.slots['domain-modeling'], 'disabled');
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /^roster: .*version/);
});

test('an empty forge.yaml is present and reported for its missing version', () => {
  const r = resolveRoster('', undefined);
  assert.equal(r.present, true);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /^roster: .*version/);
});

test('an unsupported version is reported and the file still read as version 1', () => {
  for (const v of ['2', '"1"', '0']) {
    const r = resolveRoster(`version: ${v}\nenforce: true`, undefined);
    assert.equal(r.enforce, 'on');
    assert.equal(r.problems.length, 1, v);
    assert.match(r.problems[0], /^roster: .*version/);
  }
});

test('each YAML error is a roster problem naming its line', () => {
  const r = resolveRoster(yaml('version: 1', 'slots:', '  grilling: &g mine', '  domain-modeling: disabled'), undefined);
  assert.equal(r.slots['domain-modeling'], 'disabled');
  assert.deepEqual(r.problems.length, 1);
  assert.match(r.problems[0], /^roster: line 3: /);
});
