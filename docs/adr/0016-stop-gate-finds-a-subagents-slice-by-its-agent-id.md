# 16. The Stop gate finds a subagent's slice by its agent id

Status: accepted, 2026-10-19

## Context

`verified-before-stop` finds the slice from the branch of the payload's cwd. A subagent's `SubagentStop` payload carries the directory the harness assigned it, the lead's root on `feat/<slug>`, never the worktree it `cd`'d into. So the hook found no slice and allowed every subagent implementer's stop: only the implementer's own verify step held the line. A teammate pane does carry its worktree as cwd, so it was always gated.

## Decision

The cwd branch stays first and unchanged. When the payload is `SubagentStop`, carries an `agent_id`, and its cwd names no slice, the hook finds the host through git from the cwd (the parent of its git common dir, falling back to the project dir outside a repo) and reads its `.forge/state.json`. The slice, in any effort, whose `agent` equals the `agent_id` is gated exactly as a slice checkout is, on its worktree `.forge/worktrees/<slug>-<nn>`: a fresh green record at the worktree's HEAD lets the stop through and clears the denials; otherwise the stop is blocked with the `verify-record.mjs` command naming that worktree and the host, up to three times, then one stop passes with the red reason, the slice is marked `red` and its `agent` cleared. The lead writes `agent` right after each implementer's Agent call. The reason names the slice and `slice/<slug>-<nn>`, never the agent id.

## Consequences

- A subagent implementer cannot stop without a green record, under a plain lead as in a pane.
- No match, a `Stop` payload, or a matched slice whose worktree is gone allows as before, so a stale or unknown id never blocks a stop that is not an implementer's.
- The gate depends on the lead recording `agent` before the subagent can stop, and a foreground Agent call returns its id only after `SubagentStop` has fired; a lost `agent` write costs one ungated stop, which the merger's evidence step still catches.
- A fix round's implementer runs in the foreground inside the merger, with no `agent` recorded, so this gate does not hold for it; the merger's verify step after the fix is the gate of a fix round (amended 2026-10-19, owner decision at Gate 4: a background call left the merger, itself a subagent, no way to wait for the report).
- The red pass clears `agent` on either branch, so a later stop with the same id is never gated on a slice already red.
