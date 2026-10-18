# 4. The verifier writes "done"; the implementer cannot

Status: accepted, 2026-10-17

## Context

The playbook's quantifiable "done" needs evidence the agent that did the work cannot fabricate. An implementer reporting "tests pass" is a claim, not a record.

## Decision

`bin/verify-record.mjs` runs the slice's proof and the host's proof commands in the worktree and writes `.forge/verify/<slug>-<nn>.json` (head, runs, exit codes, trimmed and masked output, green). The `verified-before-stop` hook reads that record and blocks the implementer's stop until it is fresh (head equals the worktree HEAD) and green, three times at most (ADR 0014). The merger reads the record and never runs tests itself.

## Consequences

- Evidence per slice is a file the PR body quotes.
- The implementer runs the script itself (ADR 0008); the Stop hook, not the implementer's judgement, decides whether its turn may end.
