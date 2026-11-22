---
effort: hide-wrapped-commands
stage: spec
status: accepted
risk: high
updated: 2026-11-22
---

# Spec: Hide the upstream commands forge-sdlc wraps

Intent: [intent.md](intent.md) · Map: [map.md](map.md)

## Problem Statement

A driver works in a host where `mattpocock-skills` is installed beside forge-sdlc. The `/` typeahead and `/help` list Matt's commands next to the loop's. `/mattpocock-skills:wayfinder` sits beside `/forge-sdlc:wayfinder`. `to-spec`, `to-tickets`, `implement-spec`, `setup-matt-pocock-skills`, `code-review` and `pr` are listed too, though the loop reads them by file or replaces them: spec reads `to-spec`, plan reads `to-tickets`, build reads `implement-spec` and `pr`, init needs `setup-matt-pocock-skills` once, and slice-review reads `code-review`. The driver therefore has two ways in. Picking the upstream one starts a procedure outside the frame: no effort folder, no effort branch, no gate, no `.forge/state.json`. The owner hit this in forge-sdlc hosts and in prior-sdlc hosts.

## Solution

The run pane mod hides the seven upstream commands the loop wraps from the `/` typeahead and `/help`. Hidden is not disabled:

- A driver who types `/mattpocock-skills:to-spec` in full still runs it.
- The Skill tool still reaches the model-invocable ones (`code-review`, `pr`).
- The loop's by-file reads through `bin/skill-path.mjs` are unchanged.

Every other upstream command stays listed, including the model-invoked skills the agents call (`tdd`, `grilling`, `domain-modeling`, `prototype`, `codebase-design`, `research`, ...) and the user commands the loop does not wrap (`grill-me`, `triage`, `teach`, ...).

What the driver sees: typing `/to-` offers no `mattpocock-skills:to-spec` and no `to-tickets`, and `/forge-sdlc:wayfinder` is the only wayfinder offered. `npm test` keeps the hidden list equal to the upstream skills the frame reads by file (`UPSTREAM.lock`) plus `pr`.

## User Stories

1. As a driver at the composer, I want `/wayfinder` to offer only `/forge-sdlc:wayfinder`, so that I start an effort through the loop's front door and not through Matt's map procedure outside the frame.
2. As a driver, I want `/to-` to offer neither `mattpocock-skills:to-spec` nor `mattpocock-skills:to-tickets`, so that I write a spec with `/forge-sdlc:spec` and a plan with `/forge-sdlc:plan`, where the effort folder, branch and gate are kept.
3. As a driver, I want `mattpocock-skills:implement-spec` out of the typeahead, so that I build through `/forge-sdlc:build` with its worktrees, verifier and review.
4. As a driver, I want `mattpocock-skills:code-review` out of the typeahead, so that I don't mistake it for the loop's three-axis slice-review.
5. As a driver, I want `mattpocock-skills:pr` out of the typeahead, so that I leave the PR body to build, which writes the sections the gate record needs.
6. As a driver, I want `mattpocock-skills:setup-matt-pocock-skills` out of the typeahead, so that I'm not offered it on every `/se`, when a host needs it only once before `/forge-sdlc:init`.
7. As a driver, I want `/help` to leave out the same seven commands, so that the help list and the typeahead show the same set of ways in.
8. As a driver following init's stop line ("run `/mattpocock-skills:setup-matt-pocock-skills` first"), I want the full name I type to still run, so that a host's first setup keeps working.
9. As a driver who knows what I want, I want `/mattpocock-skills:to-spec` typed in full to still run, so that hiding never takes a command away from me.
10. As a driver, I want a hidden command typed in full to take its arguments as before, so that nothing changes once it runs.
11. As a driver, I want `/forge-sdlc:spec`, `/forge-sdlc:plan`, `/forge-sdlc:build`, `/forge-sdlc:init` and the other loop commands still listed with their descriptions and hints, so that hiding the duplicates costs the loop nothing.
12. As a driver, I want Matt's commands the loop does not wrap (`grill-me`, `triage`, `teach`, ...) still listed, so that I keep the upstream tools that duplicate no loop entry.
13. As a driver, I want Matt's model-invoked skills (`tdd`, `grilling`, `domain-modeling`, `prototype`, `codebase-design`, `research`, `diagnosing-bugs`, `writing-for-agents`) still listed, so that I can still call them myself.
14. As a driver with a host command or another plugin's command of the same short name (a personal `pr` skill, say), I want that command still listed, so that hiding Matt's `pr` never hides mine.
15. As a driver, I want a hidden command's description and argument hint left as upstream wrote them, so that typing it in full shows what it always showed.
16. As the spec stage, I want to keep reading `to-spec` by file through `bin/skill-path.mjs`, so that the template comes from upstream unmodified whether or not the command is listed.
17. As the plan stage, I want to keep reading `to-tickets` by file, so that hiding it does not break the breakdown.
18. As the build stage, I want to keep reading `implement-spec` and `pr` by file, so that slices and the PR body follow the upstream procedures.
19. As wayfinder, I want to keep reading Matt's `wayfinder` by file, so that charting and working the map still follow the upstream playbook.
20. As slice-review, I want to keep reading `code-review` by file, so that the standards and spec axes keep upstream's steps 3 to 5.
21. As an agent in the loop, I want the Skill tool to still reach `mattpocock-skills:code-review` and `mattpocock-skills:pr`, so that hiding a command from the menu never blocks a model invocation.
22. As an agent in the loop, I want the Skill tool to still reach `tdd`, `grilling`, `domain-modeling`, `prototype`, `codebase-design` and `research`, so that my briefs work unchanged.
23. As the maintainer, I want the hidden list in one pure module, so that the next change to it touches one place and is node-tested.
24. As the maintainer, I want `npm test` to fail when `UPSTREAM.lock` gains or loses a skill the list does not match, so that a newly wrapped upstream command is hidden in the same change and a dropped one is shown again.
25. As the maintainer, I want `npm test` to fail if a model-invoked skill the agents call, or a command the loop does not wrap, joins the list, so that the list cannot quietly grow past the intent.
26. As the maintainer, I want one matched `command.describe` hook per hidden command, so that the run pane's single hooks module never hooks the event without a matcher, which would use up the one unmatched hook the plugin may hold.
27. As the maintainer, I want the hooks registered from the run pane's `register` beside the others, so that the plugin keeps its one hooks module.
28. As the maintainer, I want a `run-pane*.test.tsx` case to show the hidden flag through the engine's own `command.describe` call over the stand-in host, so that the wiring is proven and not just the list.
29. As the maintainer, I want `npm run typecheck` to hold the new hooks to the engine's `CommandDescribeInput` and `CommandDescribeResult` declarations, so that a change in the engine's API shows up at typecheck.
30. As the maintainer, I want a failing describe hook to leave its command listed, so that the worst case is today's menu and not a missing command.
31. As the maintainer, I want the matcher to pin the provider to `mattpocock-skills`, so that a future upstream rename or a same-named command from another provider is never hidden by mistake.
32. As the maintainer of the future roster (`roster-as-code`), I want the list kept as plain data behind a small interface, so that a roster `hide:` key can replace it later without touching the hooks' wiring.
33. As the owner, I want `claude plugin list` to show a new forge-sdlc patch version, so that I can tell a host running the change from one that is not.
34. As the owner porting to prior-sdlc, I want the change kept to one pure module and a few registration lines, so that the port is a small copy.
35. As the owner at Gate 4, I want the PR's evidence to include a session where `/to-` offers no upstream `to-spec`, so that I can confirm the result by observation and not only through tests.
36. As a later session reading the project CLAUDE.md, I want a pointer to where the hidden list lives and not a copy of it, so that the always-loaded file never goes stale when the list changes.

## Implementation Decisions

- **New pure module, `hidden-commands`, in the run pane's pure parts.** This module is the single source of truth for the list. It holds the upstream plugin name (`mattpocock-skills`) and the short names of the seven hidden commands: `wayfinder`, `to-spec`, `to-tickets`, `implement-spec`, `setup-matt-pocock-skills`, `code-review`, `pr`. Its interface is small:
  - the list of short names;
  - a matcher builder that gives, for one short name, the `command.describe` matcher: `command` one of the plugin-qualified name `mattpocock-skills:<name>` or the bare `<name>`, and `provider.plugin` equal to `mattpocock-skills`;
  - a predicate (a command name and its provider's plugin to hidden or not) that the node tests use to show the matcher's meaning.

  It has no imports, so node loads it with its types stripped, as with `mark` and `help`.
- **Run pane module, `register`.** It loops over the list and registers one matched `command.describe` hook per hidden command. Each hook answers `next({ ...e, isHidden: true })`: the description and argument hint stay as upstream declared them, and `command`, `immediate` and `provider` are pinned by the engine anyway. It hooks only `command.describe` for these commands: no `command.run`, `skill.prompt` or `tool.*` hook. That is what keeps them hidden, never disabled: typed in full they run, and the Skill tool and by-file reads never pass through the describe chain.
- **Matching by provider as well as by name.** The engine exposes `provider` (an `Origin`: plugin and tier) on `CommandDescribeInput` and lets a matcher take a partial of it. Pinning `provider.plugin` hides only Matt's command. It also makes the bare-name alternative safe: a host's own `pr` or another plugin's `code-review` is never matched.
- **Fail-open.** The engine passes a command through when its describe hook fails. That is the wanted failure mode: the command stays listed, as today.
- **No invalidation.** The engine caches the answers for the session until `$.ui.invalidate("command.describe")`. The list is static, so the mod never invalidates, and a changed list takes effect from the next session.
- **The `/forge` help panel is unchanged.** Its loop and setup rows already name `/mattpocock-skills:setup-matt-pocock-skills` in full. Its m view, which lists the installed upstream release from its `SKILL.md` files, stays a full reference of that release (assumption line below).
- **No guardrails eval case.** No command hook script is added, and the project's rules on hook scripts (one script per hook, a guardrails case each) cover only command hooks, not a mod hook.
- **Version.** forge-sdlc gets a patch bump.
- **Docs.** The project CLAUDE.md's run pane paragraph gains one pointer clause: the mod hides the upstream commands the loop wraps, and the list lives in the `hidden-commands` module. The seven names are not copied there; the module stays their single source of truth. `docs/design.md` section 10 gains a `Decision:` line stating the rule (the user-facing upstream commands the loop wraps are hidden from the menu, never disabled) and pointing at a new ADR. Matt's skills, `UPSTREAM.lock` and `bin/skill-path.mjs` are not modified.

## Testing Decisions

- A good test drives the change only through its interfaces: the pure module's list, matcher and predicate, and the engine's `command.describe` call as the mod answers it. It never checks how the hooks are stored or in what order they were registered.
- **Seam 1, the highest: the engine's `command.describe` chain over the stand-in host.** A new `run-pane*.test.tsx` case uses the existing run pane fixture. The stand-in answers `command.describe` innermost with the input's description, hint and hidden flag, and the case calls `$.command.describe(...)`:
  - each of the seven, as `mattpocock-skills:<name>` with provider `mattpocock-skills`, answers `isHidden: true` with its description and hint unchanged;
  - `forge-sdlc:wayfinder`, `mattpocock-skills:tdd`, `mattpocock-skills:grill-me`, and a bare `pr` from another provider answer `isHidden: false`.

  Prior art: `run-pane.test.tsx`, `run-pane.routing.test.tsx` and `run-pane.crew.test.tsx` over `run-pane.fixture.tsx`, whose `seat` already stands in for `command.register`.
- **Seam 2: the pure module under node, for what the mod test cannot read.** A new node test reads `UPSTREAM.lock` through `bin/upstream.mjs`'s `readLock` and asserts that the hidden list equals the lock's skills plus `pr`, as sets. It asserts that no model-invoked skill from design section 10 (`tdd`, `grilling`, `domain-modeling`, `prototype`, `codebase-design`, `research`, `diagnosing-bugs`, `writing-for-agents`) and no unwrapped command (`grill-me`, `triage`, `teach`) is in the list. It also asserts the predicate's meaning: a qualified or bare upstream name from `mattpocock-skills` is hidden; the same bare name from another provider is not; `forge-sdlc:<name>` is not. Prior art: `tests/run-pane-mark.test.mjs`, which imports a run-pane `.ts` module directly, and `tests/upstream.test.mjs` for `readLock`.
- Why two seams and not one: the stand-in host has no file system under node's reach, so the lock derivation that keeps the list from drifting needs the node seam. The engine seam proves the wiring.
- `npm run typecheck` holds the hooks to `CommandDescribeInput` and `CommandDescribeResult` in the engine's declarations.
- `npm test` (both `test:node` and `test:mod`) and `npm run validate` stay green.
- Manual, recorded in the PR evidence: in a session on this repository, typing `/to-` offers no `mattpocock-skills:to-spec` or `to-tickets`; `/forge-sdlc:wayfinder` is the only wayfinder offered; `/mattpocock-skills:to-spec` typed in full still runs.

## Out of Scope

- Hiding upstream commands the loop does not wrap (`grill-me`, `triage`, `teach`, ...): they duplicate no loop entry.
- Making the list configurable: that is a roster `hide:` key, after `roster-as-code` merges.
- Disabling, uninstalling or modifying upstream skills.
- The prior-sdlc side: it gets the change through its own port.
- The run pane's `skill.prompt` matcher, which also opens the pane on an upstream `wayfinder` prompt: unchanged.
- Changing what the `/forge` panel's m view lists.

## Further Notes

- The engine allows one unmatched hook per event per plugin. That is why each hook carries a matcher and why the list is iterated in `register`, not checked inside a single unmatched hook.
- The engine also accepts a one-of array as a matcher value. A single hook over all seven names would therefore be possible. The intent's constraint asks for one hook per hidden command, and the spec keeps it.
- [ADR 0002](../../adr/0002-depend-on-the-official-pocock-plugin.md) (user-invoked upstream skills read by file) and [ADR 0009](../../adr/0009-forge-commands-chained-by-file.md) (forge commands chained by file) are why hiding is safe: no loop path depends on the menu listing.
- Policy skill `writing-for-agents`, applied: the always-loaded CLAUDE.md gets a pointer to the module, not a cache of its list (see Docs under Implementation Decisions).

## Affected users and systems

- Driver at the composer: the `/` typeahead and `/help` no longer offer the seven wrapped upstream commands; typed in full they still run.
- The loop (wayfinder, spec, plan, build, init, slice-review): no change; it keeps reading the hidden skills by file and calling the model-invocable ones through the Skill tool.
- Prior-sdlc copy: no change in this effort; it takes the same change later through its port.
- Run pane module (`register`): calls the engine's hook registration for `command.describe`, once per hidden command.
- New pure module `hidden-commands`: is called by the run pane module and by the node test.
- Engine command listing (typeahead, `/help`): calls the new `command.describe` hooks once per listed command and caches the answers for the session.
- `mattpocock-skills` plugin: unmodified; how seven of its commands appear in the menu changes.
- `UPSTREAM.lock` and `bin/upstream.mjs`: read by the new node test; unmodified.
- `bin/skill-path.mjs` and the Skill tool: unchanged.
- `/forge` help panel (`forge.tsx`, `forge/help.ts`): unchanged.
- Run pane fixture and tests: a new mod test case and a new node test.
- `plugins/forge-sdlc/.claude-plugin/plugin.json`: writes a patch version bump.
- Project CLAUDE.md: writes one pointer clause in the run pane paragraph, with no copy of the list.
- `docs/design.md` section 10 and `docs/adr/`: write a `Decision:` line and a new ADR.

## Flagged concerns

- none

## Assumptions to confirm

- recommended: the list is the `UPSTREAM.lock` skills the frame reads by file (`to-spec`, `to-tickets`, `implement-spec`, `wayfinder`, `code-review`, `setup-matt-pocock-skills`) plus `pr`, which build reads by file through `skill-path.mjs`; a test derives the first six from `UPSTREAM.lock` so the list cannot drift (source: UPSTREAM.lock; build SKILL.md)
- recommended: `code-review` and `pr` are model-invocable upstream; hiding them from the typeahead leaves the model able to call them, which is wanted (slice-review replaces code-review for the loop, but a host may still use it ad hoc through the model) (source: none)
- recommended: the hooks match each command by its plugin-qualified name `mattpocock-skills:<name>`; an unqualified upstream name shown by the engine is matched too if the engine lists one (source: none)
- recommended: the change ships as a run-pane module `hooks/run-pane/hidden-commands.ts` (pure list + predicate, node-tested) and a few lines in `run-pane.tsx` registering the hooks, with a `run-pane*.test.tsx` case over the stand-in host; no guardrails eval case, since no command hook script is added (source: CLAUDE.md Conventions)
- recommended: `plugins/forge-sdlc` bumps a patch version (source: CLAUDE.md)
- recommended: each hook's matcher also pins `provider.plugin` to `mattpocock-skills`, so that the bare-name alternative never hides a host's or another plugin's command of the same short name (a personal `pr` skill) (source: `CommandDescribeInput.provider` and the matcher rules in hooks/types/claude-code.d.ts)
- recommended: two test seams, the engine's `$.command.describe` call over the run pane fixture (the wiring) and a node test of the pure module (the lock derivation, which the stand-in host cannot read) (source: to-spec seam discipline; tests/run-pane-mark.test.mjs; tests/upstream.test.mjs)
- recommended: the `/forge` panel's m view keeps listing every upstream command of the installed release, since the intent names only the typeahead and `/help` (source: intent.md Outcome)
- recommended: the project CLAUDE.md's run pane paragraph gets one pointer clause naming the `hidden-commands` module and no copy of the list, and `docs/design.md` section 10 gets a `Decision:` line with a new ADR, because hiding the wrapped commands changes how the plugin presents its dependency (source: CLAUDE.md Conventions; writing-for-agents, single source of truth)
