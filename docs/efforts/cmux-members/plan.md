---
effort: cmux-members
stage: plan
status: accepted
risk: high
updated: 2026-10-19
---

# Plan: Visible implementers as cmux members

Spec: [spec.md](spec.md), the second spec (agent teams). Tickets: `.scratch/cmux-members/issues/03-…08-*.md`; the first plan's slice 02 is merged (871b8ac) and its other slice tickets sit under `issues/superseded/`. The tracker carries the live state (claims, frontier, closed); this file is the approved breakdown.

## Slices

| nn | title | blocked by | delivers | proof |
| --- | --- | --- | --- | --- |
| 03 | Crew theme in the contracts, config and init | none | `crew`, `member`, `agent` and the Names rows in the contracts; `## Crew` (`theme`, `names.<role>`) in the init template, this repo's forge.md and design sections 8 and 9; init's Crew question with the five presets; slice 02's rationale reworded | `node --test tests/config.test.mjs tests/init.test.mjs` → passes with `crew.theme` parsed and the Crew question with its five presets |
| 04 | Crew presets file | none | `crew.json`: five themes, eight forge pools each, rebuilt from prior-sdlc, at least three names per pool and five implementers, unique handles | `node --test tests/crew-presets.test.mjs` → passes the structural checks |
| 05 | crew-name.mjs picks and records the next name | 03, 04 | The script at its process boundary: pools, overrides, free text, fallbacks, `--slice` reuse, handle form, `-2` numbering, exit codes; CLAUDE.md Commands line | `node --test tests/crew-name.test.mjs` → passes against the shipped presets over fixture hosts |
| 06 | Stop gate finds a subagent's slice by agent id | 03 | `verified-before-stop` gates `SubagentStop` by the slice's `agent` when the cwd names no slice; the red pass clears it; eval case `verified-before-stop-agent-blocks`; design section 7 Decision line and the ADR. Risk high | `node --test tests/verified-before-stop.test.mjs tests/evals.test.mjs` → passes with the agent-id cases |
| 07 | Members reference and the build stage | 05, 06 | The members reference; build's agents as member calls, `agent` recorded, the Gate 4 member line, the shutdown after merged or red; the merger clears `agent`; design section 5 Decision line and the ADR "Agents as named members"; README line | `node --test tests/build.test.mjs tests/agents.test.mjs` → passes with the member calls and the reference |
| 08 | Members in slice-review, wayfinder and spec | 07 | Reviewers, verifier and the background fix implementer with `--slice` and the `agent` write; researchers and the isolated prototyper; the spec-writer | `node --test tests/slice-review.test.mjs tests/wayfinder.test.mjs tests/spec.test.mjs` → passes with the member calls |

## Order of work

- Frontier at start: 03, 04
- 05 after 03 and 04; 06 after 03; 07 after 05 and 06; 08 after 07

## Risks

- 06 is the only risk-high slice: isolated, early, proven by the hook tests and the eval seam; its deny reason names the slice and branch, never the agent id.
- 07 and 08 are skill text proven structurally. The first live build from a teams lead confirms what the spec lists under Further Notes: the merger as a pane teammate (its Agent tool, nested names, background reports), and whether one blocked stop in a pane counts two denials.
- The prototyper's isolation is one rule in 08; without it a teammate prototyper would run in the main checkout.
- The implementers of this build run as subagents under this plain lead; the agent-id gate of 06 lands mid-build and protects the slices that follow it.

## Prefactoring

- 03 and 04: contracts, config and the presets before the script and the hook read them.
