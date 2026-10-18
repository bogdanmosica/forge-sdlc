# word-count-02: count characters

Status: open
Labels: ready-for-agent
Blocked by: none

## What to build

`countChars(text)` in `src/chars.mjs`, counting Unicode code points.

## Acceptance criteria

- [ ] `tests/chars.test.mjs` covers ASCII, an emoji and empty text.

## Proof

`node --test tests/chars.test.mjs` passes.

Spec: docs/efforts/word-count/spec.md
