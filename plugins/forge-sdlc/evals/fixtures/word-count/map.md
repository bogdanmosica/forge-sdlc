---
effort: word-count
stage: map
status: accepted
risk: normal
updated: 2026-10-17
---

# Map: word-count CLI

## Destination

### Problem

Writers paste text into a web counter to learn its length; the repo's `countWords` has no command line.

### Outcome

`node bin/wc.mjs <file>` prints the file's words, lines and characters.

### Users

Writers working in this repo from a terminal.

### Constraints

Node 22 standard library only; no dependency.

### Open questions

none

## Notes

The repo already exports `countWords` from `src/count.mjs`.

## Decisions so far

- Output format: one line, `words lines chars`, like `wc`.

## Not yet specified

none

## Out of scope

- Reading from stdin: a later effort.
