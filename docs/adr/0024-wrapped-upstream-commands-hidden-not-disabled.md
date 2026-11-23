# 24. The upstream commands the loop wraps are hidden from the menu, never disabled

Status: accepted, 2026-11-22

## Context

`mattpocock-skills` installs beside forge-sdlc, so the `/` typeahead and `/help` list Matt's commands next to the loop's. Seven of them are ones the loop reads by file or replaces: `wayfinder`, `to-spec`, `to-tickets`, `implement-spec`, `setup-matt-pocock-skills`, `code-review` and `pr`. A driver who picks the upstream one starts a procedure outside the frame: no effort folder, no effort branch, no gate, no `.forge/state.json`. The owner hit this in forge-sdlc hosts.

Nothing in the loop depends on the menu listing: user-invoked upstream skills are read by file through `bin/skill-path.mjs` ([ADR 0002](0002-depend-on-the-official-pocock-plugin.md)), forge commands are chained by file ([ADR 0009](0009-forge-commands-chained-by-file.md)), and agents reach the model-invocable ones through the Skill tool.

## Decision

- The run pane mod registers one matched `command.describe` hook per wrapped command, answering `isHidden: true` and leaving the description and argument hint as upstream wrote them. Each matcher takes the plugin-qualified or bare name and pins `provider.plugin` to `mattpocock-skills`, so a host's or another plugin's command of the same short name stays listed. One hook per command, each with a matcher, because a plugin may hook an event only once without one.
- Hidden, never disabled: the mod hooks no `command.run`, `skill.prompt` or `tool.*` for these commands. Typed in full they run, the Skill tool still reaches `code-review` and `pr`, and the by-file reads are unchanged. A describe hook that fails leaves its command listed.
- The list lives in one pure module, `plugins/forge-sdlc/hooks/run-pane/hidden-commands.ts`. `tests/hidden-commands.test.mjs` holds it to the skills `UPSTREAM.lock` names plus `pr`, and keeps the model-invoked skills and the commands the loop does not wrap out of it. Documents point at the module and never copy the list.

## Consequences

- The driver has one way into each stage; the upstream commands the loop does not wrap (`grill-me`, `triage`, `teach`, ...) and the model-invoked skills stay listed.
- Wrapping a new upstream skill by file means adding it to `UPSTREAM.lock`, and the test then fails until the module hides it too; dropping one shows it again.
- The engine caches describe answers for the session, so a changed list takes effect from the next session.
- The `/forge` panel's m view still lists the whole installed upstream release.
- A configurable list is a later roster `hide:` key; the module's small interface is what it would replace.
