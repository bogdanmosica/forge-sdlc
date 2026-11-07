# 19. A subagent's context budget

Status: accepted, 2026-11-07

## Context

A member works until its task is done, however much context that takes. On a prior-sdlc run one prototype subagent reached ~261k tokens of context: slow, costly, and past the point where its reasoning holds up. The lead had no signal until the report came back. The engine sends `agent_id` only on a subagent's hook payloads, and the subagent's transcript sits at a fixed path beside the main one, so a hook can measure each member's context without the conversation.

## Decision

A PreToolUse hook on every tool, `context-budget`, reads the tail of the calling subagent's transcript and denies the call once the last usage line's input + cache read + cache creation reaches the host's `## Budgets` `agent_context` (default 150000). The reason tells the agent to stop calling tools and write its report: what is done, what is left, and where. The lead then dispatches a fresh member of the same role for the rest (an implementer in the same worktree, keeping the slice's name).

- The main session is never blocked: its payloads carry no `agent_id`.
- `SubagentHandback` and `SendMessage` stay allowed, so an over-budget member can still report.
- A missing or unparsable transcript passes: it is a budget, not a guardrail, and the transcript can lag a turn.

## Consequences

- A long slice ends in a report and a continuation instead of one agent's context running away.
- The budget is per host, in `docs/agents/forge.md`; a host that never sets it gets 150000.
- The transcript path is the engine's layout, not a contract; if it moves, the hook goes quiet rather than wrong.
