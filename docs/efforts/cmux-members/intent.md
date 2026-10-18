---
effort: cmux-members
stage: intent
status: draft
risk: high
updated: 2026-10-18
---

# Intent: Visible implementers as cmux members

Map: [map.md](map.md). Second intent: the first, accepted at Gate 1 on 2026-10-18, chose crew.sh as the transport; the owner reopened that the same day (ticket 07) after moving cmux to launch leads as `cmux claude-teams`. Slice 02 of the first plan, the guardrail hooks finding the host state through git, is merged and stays.

## Problem

The build stage dispatches every implementer as a background Agent subagent, and the other stages dispatch the researcher, spec-writer, verifier, reviewers and merger the same way. When the lead runs in cmux with agent teams enabled, which the Claude button now does, those sessions could each be a visible pane with a name, but the loop names none of them, so the owner sees nothing: no tab, no status, no way to click into a slice that is slow or stuck.

## Outcome

Every agent the loop starts is a **member**: an Agent call carrying a `name` drawn from the host's **crew theme**, one pool per role. Under a lead launched with agent teams enabled, each member runs as a teammate in its own visible pane under that name, listed in cmux's Crew panel. Under a plain lead the same call runs as the subagent it always was, and nothing else changes. The build report names, per slice, the member that built it. Init asks the theme once, with the five presets carried over from prior-sdlc or a free-text theme, and `forge.md` holds it. The implementer's brief, worktree, Stop hook and verify record are the same in both cases.

Observable: from a teams lead, `/forge-sdlc:build` opens one pane per frontier slice titled with the slice's member name, and the Crew panel lists them; from a plain terminal the same command runs as before, and the Gate 4 report still reads `<slug>-<nn>: <name>`.

## Users

The owner of a host repo who runs the loop from a teams lead and wants to watch the agents work. Every forge-sdlc stage that dispatches an agent. Hosts that run a plain lead, who must notice nothing beyond a name in the report.

## Constraints

- No crew.sh, no cmux-config change: the only runtime dependency is a lead launched with agent teams enabled, which the README states as what makes the names visible.
- Display only: the name is the Agent call's `name` and the state record; the brief never tells the agent its name; branches, commits, worktrees and records keep `<slug>-<nn>`.
- One script, `bin/crew-name.mjs <role> --project <host> --effort <slug>`, picks and records the next name; the skills call it before each Agent call; no pane mod.
- `## Crew` in `forge.md` holds `theme` (a preset id, `none`, or free text) and optional per-role `names:` overrides, nothing else; init asks the theme and derives nothing.
- The hooks need no change for a teammate unless the live check (ticket 09) shows that only TeammateIdle fires in a pane; until it runs the effort is `risk: high` for that doubt.
- Proof by node tests: the name script at its process boundary over fixture hosts and a crew presets file; the init template; the skills structurally.

## Open questions

- Ticket 09, the live check from a teams lead, is open and worked by the owner: (a) does a named background call bring the lead back with the completion notification carrying the report; (b) does Stop fire in the pane with the worktree as cwd; (c) do the definition's denied tools hold there; (d) does a name with a space and an apostrophe survive. The spec waits on its answer.

## Decisions so far

- [Transport: agent teams instead of crew.sh, and a crew theme for the names](../../../.scratch/cmux-members/issues/07-transport-agent-teams-and-crew-theme.md): every agent the loop starts is a named member; the theme is asked at init with prior-sdlc's five presets rebuilt per forge role (researcher, prototyper, spec-writer, implementer, verifier, reviewer, merger, general); `## Crew` holds theme and names only; `bin/crew-name.mjs` picks and records the next name, a pool run out restarts with a number, a slice keeps its name across fix rounds and resumes; display only; the slice's `member` field is the name; no close or forget rules; cmux-config out of scope.
- [Named teammates under a teams lead](../../../.scratch/cmux-members/issues/08-named-teammates-under-a-teams-lead.md): `name` is on the Agent tool in every session, so the loop always names its calls and detects nothing; four facts the docs leave open go to the live check.
- [Stop payload cwd in a member](../../../.scratch/cmux-members/issues/02-stop-payload-cwd-in-a-member.md) and [Crew Stop hook under a blocked stop](../../../.scratch/cmux-members/issues/01-crew-stop-hook-under-a-blocked-stop.md), from the first intent: `verified-before-stop` reads the slice branch from the payload's cwd; the settle-on-record rule they produced is moot without crew.sh, the verify record stays the evidence.
- Slice 02 of the first plan, merged: `test-frozen` and `spec-frozen` read the host state through git, so a session whose project dir is a worktree is still held by the guardrails.

## Out of scope

- Any change to cmux-config, including tracking crew.sh there.
- crew.sh as a transport: superseded by ticket 07; the two `crew.mjs` slices of the first plan are closed.
- Telling an agent its own name, or naming branches, commits or records after it.
- How a public host of forge-sdlc learns to launch a teams lead beyond one README line.

## Assumptions to confirm

- open: ticket 09, the live check: paste its three outputs on the ticket and rerun `/forge-sdlc:wayfinder cmux-members`; the spec waits on (a) to (d) above
- recommended: the crew presets live in the plugin as `crew.json`, the five prior-sdlc themes with pools rebuilt for the eight forge roles, each pool at least three names and the implementer pool at least five (source: ticket 07; prior-sdlc crew.json)
- recommended: used names are recorded per effort in `state.json` under `crew: { "<role>": ["<name>", …] }` next to the slices, and a slice's name under its `member` field, so a resumed build and a fix round reuse it (source: ticket 07, question 4)
- recommended: a host whose `forge.md` has no `## Crew` section, or `theme: none`, gets `<slug>-<nn>` as the implementer's name and `<role>` for the others, so panes are still told apart (source: none)
- recommended: `risk: high` only for the doubt ticket 09 settles; if Stop or SubagentStop fires in the pane with the worktree as cwd, the effort returns to normal at spec, since no path under `hooks/**` changes (source: ticket 08; forge.md Risk)
- recommended: the first intent's accepted lines on `cd <worktree>` in the implementer's step 1 and on `forge.md` committed on the effort branch stand unchanged (source: ticket 02 of the map)
