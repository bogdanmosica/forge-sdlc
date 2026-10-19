# 17. Agents as named members

Status: accepted, 2026-10-19

## Context

The owner runs the loop from a lead in cmux, and cmux now starts that lead with agent teams enabled. Every agent the loop started ran as an unnamed background subagent, so the owner saw nothing of a build: no pane, no Crew panel row, no way into a slice that is slow or stuck. Under a teams lead an Agent call that carries a `name` already opens a visible pane, but the loop named none of its calls. The first answer, crew.sh as the transport, ran a separate session per member outside the harness; the live check showed agent teams gives the same panes from the Agent tool itself, with the brief, the tool scoping and the hooks unchanged.

## Decision

Every agent the loop starts is a **member**: an Agent call carrying a `name`, defined once in `skills/build/MEMBERS.md`, which every dispatching skill links at each Agent call with the member's role.

- Agent teams is the transport, not crew.sh. The loop names every call and detects nothing: under a teams lead the call is a teammate in its own pane, under a plain lead the subagent it always was.
- The name comes from the host's crew theme through `bin/crew-name.mjs <role>`, which picks the role's next free name, records it in the effort's state, and prints it in the form the Agent tool accepts. An implementer's call passes `--slice`, so a slice keeps one name across fix rounds and resumes.
- Names are display only: never in a brief, a branch, a commit, a worktree or a record, which keep `<slug>-<nn>`. The Gate 4 report adds `<slug>-<nn>: <member>` per slice.
- Right after an implementer's call the lead writes the id the Agent result names as the slice's `agent`, which the Stop gate reads (ADR 0016).
- The wait is "the member's report arrives": the foreground return or the task notification under a plain lead, the teammate's `idle_notification` mailbox message under a teams lead. The verify record stays the evidence under both.
- Under a teams lead the lead ends a teammate with the agent-teams shutdown request once its work is settled: an implementer after its slice merges or goes red, any other member once the lead has acted on its report.

## Consequences

- From a teams lead the owner watches one pane per member, titled from the crew theme and listed in the Crew panel, and panes close as their work settles. A plain lead sees only the names in the report.
- The transport rules live in one reference; build, slice-review, wayfinder and spec point to it rather than restating it, and only it says "teammate" or "task notification".
- The merger stays a member like every other agent; its own calls through slice-review run as its subagents, since only the lead starts teammates. A pane merger keeping the Agent tool, its nested calls accepting a name an idle teammate holds, and a background call reporting back to it are hypotheses the first build from a teams lead confirms; the verify record and the merger's evidence step are the backstop.
- A call that passes `isolation` on the call itself stays a subagent under a teams lead, which is how the prototyper keeps its own worktree.
- Concurrent state writes by the lead, the merger and `crew-name.mjs` can lose an update: a lost `crew` entry costs a reused name, a lost `agent` one ungated stop that the merger's evidence step still catches.
