---
effort: word-count
stage: plan
status: accepted
risk: normal
updated: 2026-10-17
---

# Plan: word-count CLI

Spec: [spec.md](spec.md). Tickets: `.scratch/word-count/issues/`. The tracker carries the live state (claims, frontier, closed); this file is the approved breakdown.

## Slices

| nn | title | blocked by | delivers | proof |
| --- | --- | --- | --- | --- |
| 01 | count lines | none | `countLines(text)` in `src/lines.mjs` | `node --test tests/lines.test.mjs` → passes |
| 02 | count characters | none | `countChars(text)` in `src/chars.mjs` | `node --test tests/chars.test.mjs` → passes |
| 03 | wc CLI | 01, 02 | `node bin/wc.mjs <file>` prints `words lines chars` | `node --test tests/cli.test.mjs` → passes |

## Order of work

- Frontier at start: 01, 02
- 03 after 01 and 02

## Risks

- Line counting at end of file: the spec fixes the rule; 01's test covers both endings.

## Prefactoring

- none
