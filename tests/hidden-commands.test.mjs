// The wrapped upstream commands the run pane hides from the typeahead and /help
// (hooks/run-pane/hidden-commands.ts). The list follows UPSTREAM.lock, the
// skills the frame reads by file, plus `pr`, which build reads by file too.
// Node strips the module's types on import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLock } from '../plugins/forge-sdlc/bin/upstream.mjs';

const { HIDDEN_COMMANDS, UPSTREAM_PLUGIN, hiddenMatcher, isHiddenCommand } = await import(
  '../plugins/forge-sdlc/hooks/run-pane/hidden-commands.ts'
);

test('the hidden list is the skills UPSTREAM.lock names plus pr', () => {
  const expected = new Set([...Object.keys(readLock().skills), 'pr']);
  assert.deepEqual(new Set(HIDDEN_COMMANDS), expected);
  assert.equal(HIDDEN_COMMANDS.length, expected.size); // no name twice
});

test('the list is the seven the spec names, from mattpocock-skills', () => {
  assert.equal(UPSTREAM_PLUGIN, 'mattpocock-skills');
  assert.deepEqual(
    [...HIDDEN_COMMANDS].sort(),
    ['code-review', 'implement-spec', 'pr', 'setup-matt-pocock-skills', 'to-spec', 'to-tickets', 'wayfinder'],
  );
});

test('no model-invoked skill the agents call and no unwrapped command is hidden', () => {
  const modelInvoked = [
    'tdd',
    'grilling',
    'domain-modeling',
    'prototype',
    'codebase-design',
    'research',
    'diagnosing-bugs',
    'writing-for-agents',
  ];
  const unwrapped = ['grill-me', 'triage', 'teach'];
  for (const name of [...modelInvoked, ...unwrapped]) {
    assert.ok(!HIDDEN_COMMANDS.includes(name), `${name} must stay listed`);
    assert.equal(isHiddenCommand(`mattpocock-skills:${name}`, 'mattpocock-skills'), false);
  }
});

test("an upstream name, qualified or bare, from mattpocock-skills is hidden", () => {
  for (const name of HIDDEN_COMMANDS) {
    assert.equal(isHiddenCommand(`mattpocock-skills:${name}`, 'mattpocock-skills'), true, name);
    assert.equal(isHiddenCommand(name, 'mattpocock-skills'), true, name);
  }
});

test('the same name from another provider, or as forge-sdlc:<name>, stays listed', () => {
  assert.equal(isHiddenCommand('pr', 'my-tools'), false);
  assert.equal(isHiddenCommand('code-review', 'engine'), false);
  assert.equal(isHiddenCommand('mattpocock-skills:pr', 'my-tools'), false);
  assert.equal(isHiddenCommand('forge-sdlc:wayfinder', 'forge-sdlc'), false);
  assert.equal(isHiddenCommand('forge-sdlc:wayfinder', 'mattpocock-skills'), false);
});

test("a matcher names the qualified and the bare name and pins the provider's plugin", () => {
  assert.deepEqual(hiddenMatcher('to-spec'), {
    command: ['mattpocock-skills:to-spec', 'to-spec'],
    provider: { plugin: 'mattpocock-skills' },
  });
});
