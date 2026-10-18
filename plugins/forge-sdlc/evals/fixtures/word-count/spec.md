---
effort: word-count
stage: spec
status: accepted
risk: normal
updated: 2026-10-17
---

# Spec: word-count CLI

## Problem Statement

Writers paste text into a web counter to learn its length; the repo can count words but has no command line.

## Solution

Two pure functions beside `countWords`, `countLines` and `countChars`, and a CLI `bin/wc.mjs <file>` that prints `words lines chars` for the file.

## User Stories

1. As a writer, I want the line count of a text, so that I can match a line budget.
2. As a writer, I want the character count of a text, so that I can match a character budget.
3. As a writer, I want `node bin/wc.mjs <file>` to print words, lines and characters, so that I can count from the terminal.

## Implementation Decisions

- `src/lines.mjs` exports `countLines(text)`: the number of `\n`, plus one when the text is non-empty and does not end with `\n`.
- `src/chars.mjs` exports `countChars(text)`: the number of Unicode code points (`[...text].length`).
- `bin/wc.mjs` reads the file as UTF-8 and prints `<words> <lines> <chars>` on one line; a missing file prints an error to stderr and exits 1.

## Testing Decisions

- One `node:test` file per module under `tests/`, testing behaviour through the exported function or the CLI's stdout and exit code.

## Out of Scope

- Reading from stdin.

## Affected users and systems

- writers: gain a terminal counter
- `src/`: two new modules beside `src/count.mjs`
- `bin/wc.mjs`: new CLI

## Flagged concerns

- none

## Assumptions to confirm

- recommended: a line is a `\n`-terminated run of text, and a last line without `\n` counts (source: intent.md)
