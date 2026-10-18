# Named teammates under a teams lead

Type: research
Status: resolved
Labels: wayfinder:research
Map: ../map.md
Blocked by: none

## Question

The lead is launched as `cmux claude-teams`, which sets the agent-teams environment variable and `--teammate-mode auto`. The build stage then starts implementers with the Agent tool as today, adding a `name`. Answer from the Claude Code documentation on agent teams and on the Agent tool, and from `../cmux-config/skills/cmux-crew/SKILL.md` section 1 and `../cmux-config/hooks/claude-team.sh`:

1. In a teams-enabled session, does the Agent tool gain a `name` parameter, and does a call with `name` always create a named teammate in its own session, or only when the lead opts in some other way? What does a plain session (no agent teams) do with the same call: is `name` absent from the tool, ignored, or an error?
2. Does a named teammate started as a background Agent call still bring the lead back with a task notification carrying its final report, as a background subagent does today? Or does the lead learn of completion only through the mailbox, SendMessage, TaskCompleted or TeammateIdle?
3. Which hooks fire in a teammate when it stops: Stop, SubagentStop, TeammateIdle? What does the Stop payload's `cwd` carry: the lead's cwd or the teammate's own, after the teammate ran `cd <worktree>`? This decides whether `verified-before-stop` holds in a teammate as it does in a crew.sh member.
4. Does a `subagent_type` from a plugin (`forge-sdlc:implementer`) give the teammate that definition's model, tools and prompt, including its `disallowedTools`?
5. How is a teammate's name shown in cmux's Crew panel, and what characters does a name allow (spaces, apostrophes, as in "Seven of Nine" or "O'Brien")?

Tag every claim the docs do not state outright as a hypothesis, and say which the first live build from a teams lead must confirm.

## Answer

`name` exists on the Agent tool in every session. Under a teams-enabled interactive lead a named call launches a teammate, a separate session and a split pane under `cmux claude-teams`, unless the call is a fork or passes `isolation`; in a plain session the name only makes the subagent addressable, never an error. So no detection is needed: the loop always names its calls. The plugin definition's model and tools apply to the teammate.

Unconfirmed by the docs, left for a live check from a teams lead: whether a named background call still brings the lead back with the completion notification carrying the report (the verify record stays the evidence either way); whether Stop fires inside a split-pane teammate with the teammate's own cwd, which is what `verified-before-stop` needs (SubagentStop is already covered; only TeammateIdle would need a hook change); whether `disallowedTools` holds in a split pane; which characters a name allows (spaces and apostrophes undocumented; one cmux path splits on whitespace).

Note: `docs/research/cmux-members/named-teammates-under-a-teams-lead.md`. Resolved 2026-10-18.
