# 23. A slice's proof is a fenced block under the plan table

Status: accepted, 2026-11-11

## Context

`plan.md` carried each slice's proof in the last column of the slice table. The monorepo's furniture-shop efforts paid-order-email-once and failed-payment-email (2026-11-11) both had proofs with a shell pipe (`vitest list … | grep -c …`):

- **The cell is not the command.** Markdown needs the pipe written `\|` inside a table, so the plan carried a note to run the proof "exactly as the ticket's `## Proof` gives it", and the text in plan.md could not be pasted into a shell.
- **The formatter rewrote the table.** oxfmt reflowed the table with the long command in it, so plan.md left the plan step unformatted and needed an amend and force-push of a pushed commit.
- **Counting names bent the tests.** A proof that counts tests by name (`grep -c`) counts an `it.each` block once, so test names were shaped to reach the count.

## Decision

- The slice table keeps nn, title, blocked by and delivers. Each slice's proof sits below it under `### Proofs`, as `#### <nn>`, a fenced `sh` block with the command, and the observable on the line after it (`skills/plan/PLAN-TEMPLATE.md`). The ticket's `## Proof` and the PR body's `## Plan` carry the same block verbatim.
- The plan step prefers a proof that observes behaviour (a test file or tag that passes) over one that counts tests by name.

## Consequences

- The verifier, the implementer and the PR body read a command that runs as written; no escaping note.
- plan.md files written before 0.7.3 keep their proof column. Nothing parses plan.md for proofs (the verifier takes the command from the ticket), so they need no migration.
