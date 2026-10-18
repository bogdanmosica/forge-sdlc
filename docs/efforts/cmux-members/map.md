---
effort: cmux-members
stage: map
status: draft
risk: normal
updated: 2026-10-18
---

# Visible implementers as cmux members

## Destination

### Problem

The build stage dispatches every implementer as a background Agent subagent. When the lead runs inside cmux, the owner cannot see those sessions: no tab, no status, no way to click into a slice that is taking long or has stopped. The crew the owner watched during the first build of this plugin was spawned by hand through crew.sh, outside the loop.

### Outcome

A spec and plan for forge-sdlc alone. When the lead runs inside cmux, each implementer is a **member**: a visible cmux session hosting `forge-sdlc:implementer` in the slice's worktree, spawned through crew.sh, awaited through its report, closed when its slice merges. Anywhere else, or when crew.sh is missing or fails, the implementer is the Agent subagent it is today, and the build report says which transport each slice used. The implementer's brief, worktree, Stop hook and verify record are the same in both modes.

### Users

The owner of a host repo who runs `/forge-sdlc:build` from a cmux lead and wants to watch the slices build. The merger, which spawns fix-mode implementers through the same path. Hosts outside cmux, who must see no change.

### Constraints

- cmux-config is a dependency this effort reads, never a deliverable. crew.sh lives untracked at `~/.config/cmux/scripts/crew.sh` and is called where it is.
- forge-sdlc keeps cutting `.forge/worktrees/<slug>-<nn>` and the dependency symlink itself; crew.sh's own `--worktree` is not used, the member gets `--repo <worktree>`.
- One brief, two transports: the member's task file carries the same pointers the Agent prompt carries; no model or effort flags, the agent definition rules.
- No hook changes unless a ticket proves one necessary; then that slice is risk high and adds its guardrail eval case.
- Proof by node tests: a fake crew.sh fixture that records its arguments and writes a report file for the member path, the cmux variables unset for the fallback path.

### Open questions

- Does cmux's own Stop hook mark a member done, and deliver the wake-up, when forge's `verified-before-stop` hook blocks that stop? (ticket: crew Stop hook under a blocked stop)
- What cwd does the Stop payload carry inside a member, and does `verified-before-stop` read the slice branch from it? (ticket: Stop payload cwd in a member)

## Notes

Engineering, in this plugin. Every session reads `docs/design.md` sections 5 and 7 (the build stage and the hooks), `GLOSSARY.md`, and the cmux-crew skill in `../cmux-config/skills/cmux-crew/SKILL.md`. Skills to consult: `mattpocock-skills:codebase-design` when placing `bin/crew.mjs`, `mattpocock-skills:writing-for-agents` for the skill and agent edits. Standing preference: the member path is a convenience over the subagent path, never a requirement; a host outside cmux must not notice this effort.

## Decisions so far

- Destination settled by grilling on 2026-10-18, fourteen questions, every recommendation accepted:
  - Mechanism: crew.sh spawns, not agent teams; a member works from any cmux-hosted lead, panes from agent teams need a `cmux claude-teams` launch the plugin cannot control.
  - Detection: inside cmux means the workspace id variable is set and crew.sh exists and is executable; anything else falls back to the subagent silently, with one line in the build report.
  - Host knob: `forge.md` gains `## Crew` with `mode: auto | crew | agent` (default auto) and `script: ~/.config/cmux/scripts/crew.sh`, both derived by init.
  - Who: implementers only, first build and fix mode alike; merger, verifier, researcher and reviewers stay Agent calls.
  - Spawn: role `forge-sdlc:implementer`, task file under `.forge/notes/<slug>/`, `--repo <worktree>`, `--permission-mode auto`, name `<slug>-<nn>`, no model or effort flags.
  - Waiting and evidence: a background `crew.sh await` plus cmux's wake-up message; the verify record stays the evidence, the report file is the summary line.
  - Lifecycle: close a member's tab when its slice merges, keep a red slice's tab open, forget every record when the build ends.
  - Where: one script, `bin/crew.mjs`, with `spawn`, `await`, `close`, applying the detection, wrapping crew.sh or answering `mode: agent` as JSON, never making the Agent call itself; build and slice-review call it.
  - Spawn failure: that slice falls back to a subagent and the build report says so.
  - Vocabulary: **lead** and **member** added to the glossary; "crew" stays cmux's word.

## Not yet specified

- Agent teams as a second member transport, if cmux makes `cmux claude-teams` the default launch: named Agent calls would then render as panes with no crew.sh at all.
- How init derives the `## Crew` section on a host where cmux is installed but the lead is not in it (probably `auto` unchanged, nothing to derive).
- Whether the build report's transport line belongs in `state.json` per slice, so a resumed build knows which members to await or close.
- Publishing: a public host of forge-sdlc has no crew.sh. The fallback already makes the member path optional; what the README says about obtaining crew.sh, and whether a public cmux-crew package or a `cmux new-surface` adapter in the plugin replaces it, is decided when forge-sdlc goes public, not here.

## Out of scope

- Changes to cmux-config: tracking crew.sh in that repo, its sidebars, its hooks. Housekeeping for that repo, not this effort.
- Visibility for the merger, verifier, researcher or reviewers.
- Any change to what the implementer does once it is running.
