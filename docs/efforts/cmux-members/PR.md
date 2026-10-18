# Visible implementers as cmux members

Second intent (2026-10-18): the transport moved from crew.sh to named agent teams after the owner made `cmux claude-teams` the default lead. Slice 02 of the first plan is merged on this branch.

## Intent

### Problem

The loop dispatches every agent as an unnamed Agent call. Under a lead with agent teams enabled each could be a visible, named pane; today the owner sees none of them.

### Outcome

Every agent the loop starts is a member: an Agent call carrying a name from the host's crew theme, one pool per role. Under a teams lead each runs as a teammate in its own pane, listed in the Crew panel; under a plain lead nothing changes but the name in the report. Init asks the theme once, with the five presets carried over from prior-sdlc or free text, and `forge.md` holds it.

### Users

The owner running the loop from a teams lead; every stage that dispatches an agent; hosts on a plain lead, who notice nothing beyond a name in the report.

### Constraints

No crew.sh, no cmux-config change. Display only. One script, `bin/crew-name.mjs`, picks and records names. `## Crew` holds theme and names only. No hook change unless the live check shows only TeammateIdle fires in a pane. Proof by node tests.

### Open questions

Ticket 09, the live check from a teams lead, worked by the owner: completion notification, Stop and its cwd in the pane, denied tools in the pane, name characters.

## Assumptions to confirm

- open: ticket 09, the live check: paste its three outputs on the ticket and rerun `/forge-sdlc:wayfinder cmux-members`; the spec waits on (a) to (d) above
- recommended: the crew presets live in the plugin as `crew.json`, the five prior-sdlc themes with pools rebuilt for the eight forge roles, each pool at least three names and the implementer pool at least five (source: ticket 07; prior-sdlc crew.json)
- recommended: used names are recorded per effort in `state.json` under `crew: { "<role>": ["<name>", …] }` next to the slices, and a slice's name under its `member` field, so a resumed build and a fix round reuse it (source: ticket 07, question 4)
- recommended: a host whose `forge.md` has no `## Crew` section, or `theme: none`, gets `<slug>-<nn>` as the implementer's name and `<role>` for the others, so panes are still told apart (source: none)
- recommended: `risk: high` only for the doubt ticket 09 settles; if Stop or SubagentStop fires in the pane with the worktree as cwd, the effort returns to normal at spec, since no path under `hooks/**` changes (source: ticket 08; forge.md Risk)
- recommended: the first intent's accepted lines on `cd <worktree>` in the implementer's step 1 and on `forge.md` committed on the effort branch stand unchanged (source: ticket 02 of the map)
