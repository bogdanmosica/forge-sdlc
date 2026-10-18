# 6. Unattended between gates

Status: accepted, 2026-10-17

## Context

The playbook moves human attention from line-by-line reading to the gates. A build that asks questions mid-run is attended by nobody at the right moment and stalls.

## Decision

Between Gate 3 (plan approved) and Gate 4 (PR ready) nothing asks a question: `AskUserQuestion` is not in the build's vocabulary. A choice the spec and tickets leave open takes the reading the spec supports and is recorded on the ticket; a slice that cannot finish ends red and is listed in the PR body. Earlier stages that are human-in-the-loop by nature (grilling, the plan quiz) stay interactive, and a gap in intent or spec becomes an assumption line, `recommended` or `open`, that the owner settles at the next gate.

## Consequences

- The driver is needed at four places only, each a state of the same PR.
- Open assumptions stop the front door at a gate instead of being guessed.
