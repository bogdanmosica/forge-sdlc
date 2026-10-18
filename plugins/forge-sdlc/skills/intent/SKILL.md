---
name: intent
description: Reshape an effort's Destination by hand through a short grilling, without charting or working tickets, and re-commit map.md (and intent.md while it is a draft) on feat/<slug>.
disable-model-invocation: true
argument-hint: "<slug>"
---

`/forge-sdlc:intent <slug>` rewrites one map's **Destination** (Problem, Outcome, Users, Constraints, Open questions) before the map goes further. It charts nothing and works no ticket: the tracker stays as it is, and `.forge/state.json` keeps its stage.

## 1. Precondition

`git switch feat/<slug>`, then `git log -1 -- docs/efforts/<slug>/map.md` prints a commit. When it prints nothing, stop with one line: `/forge-sdlc:wayfinder <idea>` charts the map and names its first Destination. Read the map's `## Destination`, and `docs/efforts/<slug>/intent.md` with its frontmatter `status` when it exists.

Done when the Destination is in hand and intent.md is known to be `draft`, `accepted` or absent.

## 2. Grill the Destination

`mattpocock-skills:grilling` on the five Destination headings alone, the current text as each recommended answer; domain terms through `mattpocock-skills:domain-modeling`. The human answers every question themselves. A question about how to build is a ticket for the map: name it in the report and keep grilling the Destination.

Done when the human confirms the new Destination, heading by heading.

## 3. Rewrite

- `map.md`: replace `## Destination` and its five `###` headings; set `updated` to today; every other line verbatim.
- `intent.md` at `status: draft`: replace the same five headings and `updated`; Decisions so far, Out of scope and Assumptions to confirm verbatim. When the PR (`gh pr view feat/<slug> --json body`) or `docs/efforts/<slug>/PR.md` exists, rewrite only its `## Intent` section from the new intent.md, every other section verbatim.
- `intent.md` at `status: accepted`: Gate 1 passed on it, so it stays as committed; the report says the map moved past it.

Done when `git diff` touches only those sections.

## 4. Commit

Commit the changed files on `feat/<slug>`: `intent(<slug>): reshape destination`. Push `feat/<slug>` when `origin/feat/<slug>` exists.

Done when `git log -1` shows the commit and `git status --short docs/efforts/<slug>/` prints nothing.

## 5. Report

Three lines: the commit, the files changed (and `intent.md accepted, unchanged` when so), and the next move, `/forge-sdlc:wayfinder <slug>` to work the map toward the new Destination, with any ticket question raised in step 2. Done when the report is printed.
