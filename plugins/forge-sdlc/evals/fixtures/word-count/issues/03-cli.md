# word-count-03: wc CLI

Status: open
Labels: ready-for-agent
Blocked by: 01-count-lines.md, 02-count-chars.md

## What to build

`bin/wc.mjs <file>` printing `words lines chars` from `countWords`, `countLines`, `countChars`.

## Acceptance criteria

- [ ] `tests/cli.test.mjs` runs the CLI on a temp file and checks stdout, and checks a missing file exits 1.

## Proof

`node --test tests/cli.test.mjs` passes.

Spec: docs/efforts/word-count/spec.md
