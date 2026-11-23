// The wrapped upstream commands through `claude plugin test`: the engine's own
// `command.describe` call, as the typeahead and /help make it, answers hidden
// for the seven mattpocock-skills commands the loop wraps, their description
// and hint as upstream wrote them, and leaves every other command listed. The
// test stands for the engine beneath the mod: innermost, a command describes
// as it declares itself.
import { test, expect } from 'claude-code/testing';
import type { Engine } from 'claude-code/testing';
import type { On, Origin } from 'claude-code';

const MATT: Origin = { plugin: 'mattpocock-skills', tier: 'user' };

function seat(on: On) {
  on('command.describe', ($, e) => ({
    description: e.description,
    ...(e.argumentHint === undefined ? {} : { argumentHint: e.argumentHint }),
    isHidden: e.isHidden,
  }));
}

const describe = ($: Engine, command: string, provider: Origin) =>
  $.command.describe({
    command,
    description: `what ${command} does`,
    argumentHint: '[topic]',
    isHidden: false,
    immediate: false,
    provider,
  });

// Written out, not read from the module: the spec's seven.
const WRAPPED = ['wayfinder', 'to-spec', 'to-tickets', 'implement-spec', 'setup-matt-pocock-skills', 'code-review', 'pr'];

for (const name of WRAPPED) {
  test(`mattpocock-skills:${name} describes as hidden, its description and hint unchanged`, async ($, on) => {
    seat(on);
    expect(await describe($, `mattpocock-skills:${name}`, MATT)).toEqual({
      description: `what mattpocock-skills:${name} does`,
      argumentHint: '[topic]',
      isHidden: true,
    });
  });
}

test('a bare upstream name from mattpocock-skills is hidden too', async ($, on) => {
  seat(on);
  expect((await describe($, 'to-spec', MATT)).isHidden).toBe(true);
});

const LISTED: [string, Origin][] = [
  ['forge-sdlc:wayfinder', { plugin: 'forge-sdlc', tier: 'user' }],
  ['mattpocock-skills:tdd', MATT],
  ['mattpocock-skills:grill-me', MATT],
  ['pr', { plugin: 'my-tools', tier: 'user' }],
];

for (const [command, provider] of LISTED) {
  test(`${command} from ${provider.plugin} stays listed`, async ($, on) => {
    seat(on);
    expect(await describe($, command, provider)).toEqual({
      description: `what ${command} does`,
      argumentHint: '[topic]',
      isHidden: false,
    });
  });
}
