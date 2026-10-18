---
effort: cmux-members
stage: intent
status: draft
risk: normal
updated: 2026-10-18
---

# Intent: Visible implementers as cmux members

Map: [map.md](map.md)

## Problem

The build stage dispatches every implementer as a background Agent subagent. When the lead runs inside cmux, the owner cannot see those sessions: no tab, no status, no way to click into a slice that is taking long or has stopped. During the first build of this plugin the owner watched a crew spawned by hand through crew.sh, outside the loop, and asked for the same view from the loop itself.

## Outcome

When the lead runs inside cmux, each implementer is a **member**: a visible cmux session hosting `forge-sdlc:implementer` in the slice's worktree, spawned through crew.sh, awaited through its report and the verify record, closed when its slice merges. Anywhere else, or when crew.sh is missing or fails to spawn, the implementer is the Agent subagent it is today. The build report names the transport of every slice. The implementer's brief, worktree, Stop hook and verify record are identical in both modes, and a host outside cmux sees no change.

Observable: on a cmux lead, `/forge-sdlc:build` opens one tab per frontier slice named `<slug>-<nn>`, the Crew panel shows them, and each tab closes when its slice merges; on a plain terminal the same command runs as before.

## Users

The owner of a host repo who runs `/forge-sdlc:build` from a cmux lead and wants to watch the slices build. The merger, which spawns fix-mode implementers through the same path. Hosts outside cmux, who must notice nothing.

## Constraints

- cmux-config is a dependency, never a deliverable: crew.sh is called where it lives, `~/.config/cmux/scripts/crew.sh`, and no file in that repo changes.
- forge-sdlc keeps cutting `.forge/worktrees/<slug>-<nn>` and the dependency symlink; the member gets `--repo <worktree>`, never crew.sh's `--worktree`.
- One brief, two transports: the member's task file carries the pointers the Agent prompt carries; no model or effort flags, the agent definition rules.
- No hook changes. Both research tickets closed without one, so the effort is `risk: normal`; a slice that turns out to need one becomes high and adds its guardrail eval case.
- Proof by node tests: a fake crew.sh fixture that records its arguments and writes a report file for the member path; the cmux variables unset for the fallback path; a Stop payload with a subfolder cwd for the hook.

## Open questions

none

## Decisions so far

- Grilling, 2026-10-18, fourteen questions, every recommendation accepted: crew.sh spawns rather than agent teams; detection is the workspace id variable plus an executable crew.sh; `forge.md` gains `## Crew` with `mode: auto | crew | agent` and `script`; implementers only, first build and fix mode; spawn with role `forge-sdlc:implementer`, a task file under `.forge/notes/<slug>/`, `--repo <worktree>`, `--permission-mode auto`, name `<slug>-<nn>`; a background await plus cmux's wake-up; the verify record stays the evidence; close on merge, keep red tabs, forget at build end; one script `bin/crew.mjs` with `spawn`, `await`, `close`; a failed spawn falls back per slice; **lead** and **member** in the glossary.
- [Stop payload cwd in a member](../../../.scratch/cmux-members/issues/02-stop-payload-cwd-in-a-member.md): the payload's cwd is the member's current directory, the worktree crew.sh launched it in; `verified-before-stop` reads the slice branch and the host config correctly without change. Keep the implementer's `cd <worktree>` rule.
- [Crew Stop hook under a blocked stop](../../../.scratch/cmux-members/issues/01-crew-stop-hook-under-a-blocked-stop.md): Stop hooks run in parallel, so every blocked stop still marks the member done and wakes the lead; `bin/crew.mjs await` settles a member only on a green verify record at the worktree HEAD or a red slice in state.

## Out of scope

- Changes to cmux-config, including tracking crew.sh there: housekeeping for that repo.
- Visibility for the merger, verifier, researcher or reviewers: short-lived, they report to the lead directly.
- Any change to what the implementer does once it runs.
- Agent teams as a transport, and how a public host obtains crew.sh: both in the map's Not yet specified, for later efforts.

## Assumptions to confirm

- recommended: `state.json` slices gain a `member` field (`{ id, record }`, or null for a subagent) so a resumed build awaits and closes the right members and the report names each slice's transport (source: none)
- recommended: `await` treats a `done` status without a green verify record at the worktree HEAD, and without `red` in state, as still running and awaits again, because parallel Stop hooks make `done` fire on every blocked stop (source: Crew Stop hook under a blocked stop)
- recommended: the parallel-peers behaviour of Stop hooks stays a hypothesis the docs do not state outright; the await rule above holds under either reading, so the build slice's proof includes one fixture run and no ticket is opened (source: Crew Stop hook under a blocked stop)
- recommended: init derives `## Crew` as `mode: auto` and `script: ~/.config/cmux/scripts/crew.sh` without asking, since auto is the only value most hosts ever need (source: none)
- recommended: a member reads the host config from its own checkout, so `docs/agents/forge.md` must be committed on the effort branch the slice is cut from; it is in this repo, and the build skill states it as a precondition (source: Stop payload cwd in a member)
- recommended: the implementer's step 1 keeps "your first Bash call is `cd <worktree>`" with the reason reworded to cover both transports (source: Stop payload cwd in a member)
