# word-count-01: count lines

Status: open
Labels: ready-for-agent
Blocked by: none

## What to build

`countLines(text)` in `src/lines.mjs`, as the spec's Implementation Decisions define a line.

## Acceptance criteria

- [ ] `tests/lines.test.mjs` covers text with and without a final newline, and empty text.

## Proof

`node --test tests/lines.test.mjs` passes.

Spec: docs/efforts/word-count/spec.md
