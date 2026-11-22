// Hidden commands: the upstream commands the loop wraps, left out of the `/`
// typeahead and /help so a driver has one way in. Hidden, never disabled:
// typed in full they run, and the Skill tool and the frame's by-file reads
// (bin/skill-path.mjs) never pass through the describe chain. Pure, no
// imports: run-pane.tsx registers one matched `command.describe` hook per
// name, and tests/hidden-commands.test.mjs holds the list to UPSTREAM.lock's
// skills plus `pr`.

// The plugin whose commands are hidden; a matcher pins `provider.plugin` to it,
// so a host's or another plugin's command of the same short name stays listed.
export const UPSTREAM_PLUGIN = 'mattpocock-skills';

// The short names: what spec, plan, build, wayfinder, init and slice-review
// read by file or replace.
export const HIDDEN_COMMANDS: readonly string[] = [
  'wayfinder',
  'to-spec',
  'to-tickets',
  'implement-spec',
  'setup-matt-pocock-skills',
  'code-review',
  'pr',
];

export type HiddenMatcher = { command: readonly string[]; provider: { plugin: string } };

// The `command.describe` matcher for one short name: its plugin-qualified or
// bare name, from the upstream plugin only.
export function hiddenMatcher(name: string): HiddenMatcher {
  return { command: [`${UPSTREAM_PLUGIN}:${name}`, name], provider: { plugin: UPSTREAM_PLUGIN } };
}

// Whether a listed command, by its name and its provider's plugin, is one of
// the hidden: what the matchers above select, stated for the node tests.
export function isHiddenCommand(command: string, plugin: string): boolean {
  return HIDDEN_COMMANDS.some((name) => {
    const m = hiddenMatcher(name);
    return m.provider.plugin === plugin && m.command.includes(command);
  });
}
