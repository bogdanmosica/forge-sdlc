## Intent

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

## Assumptions to confirm

- recommended: a line is a `\n`-terminated run of text, and a last line without `\n` counts (source: intent.md)

## Spec

[spec.md](spec.md): 3 user stories.

## Flagged concerns

- none

## Plan

| nn | title | blocked by | proof |
| --- | --- | --- | --- |
| 01 | count lines | none | `node --test tests/lines.test.mjs` |
| 02 | count characters | none | `node --test tests/chars.test.mjs` |
| 03 | wc CLI | 01, 02 | `node --test tests/cli.test.mjs` |
