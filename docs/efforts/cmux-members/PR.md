# Visible implementers as cmux members

## Intent

### Problem

The build stage dispatches every implementer as a background Agent subagent. When the lead runs inside cmux, the owner cannot see those sessions: no tab, no status, no way to click into a slice that is taking long or has stopped.

### Outcome

When the lead runs inside cmux, each implementer is a member: a visible cmux session hosting `forge-sdlc:implementer` in the slice's worktree, spawned through crew.sh, awaited through its report and the verify record, closed when its slice merges. Anywhere else, or when crew.sh is missing or fails to spawn, the implementer is the Agent subagent it is today, and the build report names each slice's transport. A host outside cmux sees no change.

### Users

The owner running `/forge-sdlc:build` from a cmux lead; the merger, for fix-mode implementers; hosts outside cmux, who must notice nothing.

### Constraints

cmux-config is a dependency, not a deliverable. forge-sdlc keeps its own worktrees and passes `--repo`. One brief, two transports. No hook changes, risk normal. Proof by node tests against a fake crew.sh and with the cmux variables unset.

### Open questions

none

## Assumptions to confirm

- recommended: `state.json` slices gain a `member` field (`{ id, record }`, or null for a subagent) so a resumed build awaits and closes the right members and the report names each slice's transport (source: none)
- recommended: `await` treats a `done` status without a green verify record at the worktree HEAD, and without `red` in state, as still running and awaits again, because parallel Stop hooks make `done` fire on every blocked stop (source: Crew Stop hook under a blocked stop)
- recommended: the parallel-peers behaviour of Stop hooks stays a hypothesis the docs do not state outright; the await rule above holds under either reading, so the build slice's proof includes one fixture run and no ticket is opened (source: Crew Stop hook under a blocked stop)
- recommended: init derives `## Crew` as `mode: auto` and `script: ~/.config/cmux/scripts/crew.sh` without asking, since auto is the only value most hosts ever need (source: none)
- recommended: a member reads the host config from its own checkout, so `docs/agents/forge.md` must be committed on the effort branch the slice is cut from; it is in this repo, and the build skill states it as a precondition (source: Stop payload cwd in a member)
- recommended: the implementer's step 1 keeps "your first Bash call is `cd <worktree>`" with the reason reworded to cover both transports (source: Stop payload cwd in a member)
