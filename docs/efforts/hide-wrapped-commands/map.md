---
effort: hide-wrapped-commands
stage: map
status: draft
risk: high
updated: 2026-11-22
---

# Hide the upstream commands forge-sdlc wraps

## Destination

### Problem

With `mattpocock-skills` installed beside forge-sdlc, the `/` typeahead and `/help` list Matt's commands next to the loop's: `/mattpocock-skills:wayfinder` beside `/forge-sdlc:wayfinder`, and `to-spec`, `to-tickets`, `implement-spec`, `setup-matt-pocock-skills`, `code-review`, `pr`, which the loop reads by file or replaces (spec, plan, build, init, slice-review, build's PR body). A driver sees two ways in and can start an upstream procedure outside the frame, with no effort folder, branch, gate or state. The owner reported it from both forge-sdlc and prior-sdlc hosts.

### Outcome

The run pane mod registers `command.describe` hooks that set `isHidden: true` for the upstream commands the loop wraps: `mattpocock-skills:wayfinder`, `to-spec`, `to-tickets`, `implement-spec`, `setup-matt-pocock-skills`, `code-review`, `pr`. They leave the `/` typeahead and `/help`; typed in full they still run, and the Skill tool and the loop's by-file reads (`bin/skill-path.mjs`) are untouched. Matt's model-invoked skills the agents call (`tdd`, `grilling`, `domain-modeling`, `prototype`, `codebase-design`, `research`, ...) and every upstream command the loop does not wrap stay listed.

Observable: in a session on this repo, typing `/to-` in the composer offers no `mattpocock-skills:to-spec` or `to-tickets`; `/forge-sdlc:wayfinder` is the only wayfinder offered; `/mattpocock-skills:to-spec` typed in full still runs; `npm test` holds the list to the upstream skills the frame reads (`UPSTREAM.lock`) plus the two it replaces.

### Users

A driver at the composer, who sees only the loop's way in. The loop itself, which keeps reading and calling the hidden skills. The prior-sdlc copy, which takes the same change through the usual port.

### Constraints

- Hidden, never disabled: typed in full they run; the Skill tool and by-file reads are untouched.
- One matched `command.describe` hook per hidden command (a plugin may hook an event only once without a matcher), registered from the run pane module beside the others.
- The list is hard-coded in a pure module under `hooks/run-pane/` for now; the roster (`roster-as-code`) may take it over later as a `hide:` key.
- A change under `plugins/forge-sdlc/hooks/**`: `risk: high`, attended.
- Matt's skills unmodified.

### Open questions

none

## Notes

Engineering, in this plugin. Sessions read `plugins/forge-sdlc/hooks/run-pane.tsx`, the `CommandDescribeInput` declaration in `hooks/types/claude-code.d.ts`, `UPSTREAM.lock`, `GLOSSARY.md`. Skills to consult: `mattpocock-skills:writing-for-agents` for any skill or doc edit.

## Decisions so far

- Destination settled by grilling on 2026-11-22, three questions, every recommendation accepted: hide (b), the upstream user-facing commands the loop wraps or reads by file, not the model-invoked skills agents call; a `command.describe` hook in the run pane mod with a hard-coded list, the roster later; a small effort with no fog, `risk: high`, attended.

## Not yet specified

none: the way is clear.

## Out of scope

- Hiding upstream commands the loop does not wrap (`grill-me`, `triage`, `teach`, ...).
- Making the list configurable (a roster `hide:` key belongs to a later change).
- Disabling or uninstalling upstream skills; the prior-sdlc side (its own port).
