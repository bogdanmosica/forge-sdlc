# 20. An over-budget stop leaves the slice open

Status: accepted, 2026-11-07

## Context

ADR 0019 added `context-budget`: a subagent past `agent_context` is denied every tool call but the hand-back, and told to report so the lead can continue the work with a fresh member. An implementer in that state still meets `verified-before-stop` when it stops. With no green record at HEAD the gate blocks and names `verify-record.mjs`, which the budget hook will not let it run; after three blocks the fourth stop passes and the slice is marked red, its `agent` cleared. A half-built slice, which the continuation was meant to finish, was reported red.

## Decision

`verified-before-stop` asks the budget hook's question before counting a denial: when the stopping payload carries an `agent_id` whose transcript's context has reached the host's budget, the stop passes once with a message naming the slice and the budget. The slice keeps its status and its `agent`, and its denial count is cleared, so the continuation implementer starts from zero.

- The measure is `context-budget.mjs`'s own (`overBudget`), so the two hooks never disagree on who is over.
- A green record still passes silently; the main session, which carries no `agent_id`, is never exempt; an unreadable transcript is not over budget, so the gate blocks as before.

## Consequences

- An over-budget implementer ends in a report and an open slice, and the lead's continuation (MEMBERS.md step 3) picks it up in the same worktree.
- A member that runs out of budget repeatedly never turns red by itself; the lead's report shows each continuation, and the owner stops the run if a slice never converges.
