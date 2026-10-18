# 8. The verify record is written by the script, whoever runs it

Status: accepted, 2026-10-17

## Context

Design section 6 made the verifier a separate agent so that "done" is a record the implementer cannot write. In the build, the implementer has no Agent tool, so it cannot call the verifier. Its Stop hook blocks until a green record exists, and that loop has to close inside the implementer's own session.

## Decision

`bin/verify-record.mjs` is the only writer of `.forge/verify/<slug>-<nn>.json`. It runs the slice's proof and the host's proof commands, and records exit codes, trimmed output and the HEAD it ran at. The implementer runs it before it stops, after merging the effort tip into its branch, and the Stop hook's reason names the same command. The verifier agent runs it when `build` or `slice-review` finds the record missing, stale or red, and after every fix round.

## Consequences

- "Done" is still a record of commands and exit codes, not a claim. The record is fresh only while its `head` equals the worktree's HEAD, so a later commit makes it stale.
- The implementer can run the script, so independence now rests on the script, not on a second agent. An implementer that writes the JSON by hand is a brief violation that the reviewer and the merger's freshness check can catch, not a hook.
