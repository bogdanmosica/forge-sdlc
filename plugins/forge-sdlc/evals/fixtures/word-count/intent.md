---
effort: word-count
stage: intent
status: accepted
risk: normal
updated: 2026-10-17
---

# Intent: word-count CLI

Map: [map.md](map.md)

## Problem

Writers paste text into a web counter to learn its length; the repo's `countWords` has no command line.

## Outcome

`node bin/wc.mjs <file>` prints the file's words, lines and characters.

## Users

Writers working in this repo from a terminal.

## Constraints

Node 22 standard library only; no dependency.

## Open questions

none

## Decisions so far

- Output format: one line, `words lines chars`, like `wc`.

## Out of scope

- Reading from stdin: a later effort.

## Assumptions to confirm

- recommended: a line is a `\n`-terminated run of text, and a last line without `\n` counts (source: none)
