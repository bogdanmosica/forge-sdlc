# 10. The merger writes the review record

Status: accepted, 2026-10-17

## Context

Design section 6 scoped the merger to git, Skill, Agent and read. The slice-review procedure it follows appends each round and the verdict to `.forge/review/<slug>-<nn>.md`. It also needs the shell for git, the state writes and the ticket.

## Decision

The merger's tools are `Bash, Read, Grep, Glob, Write, Edit, Skill, Agent`. Its prompt also carries the project dir and the ticket, so it can write the slice's status and resolve the ticket. After a clean merge it removes the slice worktree with `git worktree remove --force`, because the symlinked dependency dir counts as untracked.

## Consequences

The merger could edit code. Its brief limits it to the review record, state, git and the ticket, and the review it runs is what guards the code.
