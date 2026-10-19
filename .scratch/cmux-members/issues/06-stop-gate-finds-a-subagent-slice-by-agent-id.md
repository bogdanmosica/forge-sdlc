# 06: cmux-members-06: Stop gate finds a subagent's slice by agent id

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Risk: high (touches plugins/forge-sdlc/hooks/**)
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** A subagent implementer that stops without a fresh green verify record is blocked, as a slice checkout is today. `verified-before-stop` keeps its cwd branch first. When the payload is `SubagentStop` with an `agent_id` and the cwd names no slice, it finds the host through git from the cwd (the lib's `hostDirOf`, falling back to the project dir), reads the host's state, and looks in every effort for the slice whose `agent` equals `agent_id`. No match, or a match whose worktree `.forge/worktrees/<slug>-<nn>` is gone, allows as now. A match is gated as a slice checkout: fresh and green at the worktree's HEAD lets the stop through and clears the denials; otherwise the stop is blocked with the verify-record command naming that worktree and host, up to three times, then one stop passes with the red reason, which also clears the slice's `agent` beside writing `status: red`. The reason names the slice and `slice/<slug>-<nn>`, never the agent id. A new guardrail eval case `verified-before-stop-agent-blocks` with its fixture, `seam.json` and `hook-*` grader; design section 7's row and a Decision line pointing to the new ADR "The Stop gate finds a subagent's slice by its agent id".

**Blocked by:** 03 (Crew theme in the contracts, config and init)

- [ ] A `SubagentStop` payload with the host as cwd on `feat/<slug>` and a matching `agent_id` blocks without a record, naming the slice's worktree and the host; a green record at the worktree's HEAD lets it through
- [ ] Three blocks, then the red pass marks the slice `red` and clears its `agent`
- [ ] An unmatched `agent_id`, a `Stop` payload with an `agent_id`, and a matched slice whose worktree is gone all allow; every existing case stays green
- [ ] `tests/evals.test.mjs` runs the new case green, and the deny reason never quotes the agent id

## Proof

`node --test tests/verified-before-stop.test.mjs tests/evals.test.mjs` → passes with the agent-id cases

## Assumptions

- recommended: the red pass clears the slice's `agent` on the cwd branch too, not only the agent-id branch, since an `agent` is cleared whenever its slice goes red; a slice without `agent` is written exactly as before (source: docs/contracts.md, state, "cleared when the slice goes `merged` or `red`")
- recommended: the agent-id branch names the slice's branch from the host's slice shape with `<slug>-<nn>` filled in, not from the worktree's checkout, so a detached worktree still gets `slice/<slug>-<nn>` in the reason (source: spec, Hook, "The reason names the slice and its branch `slice/<slug>-<nn>`")
- recommended: a `SubagentStop` with an empty `agent_id` allows, as an absent one does (source: spec, Hook, "carries an `agent_id`")
- recommended: the eval fixture writes the slice's `agent` with one inline `node -e`, beside `worktree 01`, rather than a new `host.sh` helper (source: spec, Testing Decisions, guardrail eval case "the slice's `agent` in state")
- recommended: the new ADR is 0016; slice 07's "Agents as named members" takes the next number (source: plan, order of work, "07 after 05 and 06")
- recommended: the README hooks table's `verified-before-stop` row notes the agent-id branch in this slice, the slice that changes the hook (source: spec, Design record, "the hooks table notes the agent-id branch")
