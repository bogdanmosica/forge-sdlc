# Stop gate for a subagent implementer

Type: grilling
Status: open
Labels: wayfinder:grilling
Map: ../map.md
Blocked by: none
Surfaced by: ticket 09, run 1.

## Question

`verified-before-stop` decides from the payload's `cwd` whether a stopping session is in a slice checkout. Ticket 09 showed that a subagent's `SubagentStop` payload carries the directory the harness assigned it, the lead's project directory, never the worktree the implementer `cd`'d into. So for every subagent implementer the hook reads the effort branch, finds no slice, and allows the stop: the Stop gate has never held for the plain transport, only the implementer's own step 5 has. A pane teammate may or may not be different; ticket 09's rerun tells.

The decision: how does the hook learn which slice a stopping subagent built?

- Option A, the lead records the mapping. The Agent tool's result gives the lead the subagent's id; the build and slice-review skills write it on the slice in `state.json` (`agent: <id>`). On `SubagentStop` the hook reads `agent_id` from the payload, finds the slice whose `agent` matches, and gates on that slice's verify record exactly as it gates a slice checkout today. No mapping, no slice: allow, as now. This is a change under `hooks/**` (risk high) plus two skill lines and a state field.
- Option B, the implementer writes a marker. The implementer's first step writes `.forge/agents/<something>` naming its slice. It does not know its own agent id, so the marker would have to be matched by time or by worktree, both fragile.
- Option C, leave it. The implementer runs the proof before it stops and the merger refuses a slice without a fresh green record, so a missed gate costs one merger round, not a bad merge.

Also to settle: whether the slice's `agent` field and the new `member` name live side by side in state, and whether `SubagentStop` with a matching slice should also block in a pane teammate if the rerun shows the same payload shape there.
