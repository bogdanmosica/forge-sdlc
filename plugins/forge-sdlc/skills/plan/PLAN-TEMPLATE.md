---
effort: <slug>
stage: plan
status: accepted
risk: <normal | high, from intent.md>
updated: <YYYY-MM-DD>
---

# Plan: <effort title>

Spec: [spec.md](spec.md). Tickets: <`#n`…`#m` on the tracker, or `.scratch/<slug>/issues/`>. The tracker carries the live state (claims, frontier, closed); this file is the approved breakdown.

## Slices

| nn | title | blocked by | delivers | proof |
| --- | --- | --- | --- | --- |
| 01 | <title> | none | <the end-to-end behaviour this slice makes work> | `<command>` → <observable> |
| 02 | <title> | 01 | <behaviour> | `<command>` → <observable> |

## Order of work

- Frontier at start: <01, 02>
- <03> after 01; <04> after 02 and 03

## Risks

- <risk>: <what the slice does about it, or where it is watched>

## Prefactoring

- <the change made first so the slices land easy>, or none
