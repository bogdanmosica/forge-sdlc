---
effort: autonomous-gates
stage: intent
status: draft
risk: normal
updated: 2026-10-19
---

# Intent: Autonomous run after wayfinder

Map: [map.md](map.md)

## Problem

The loop stops at four human gates: intent, spec, the plan quiz, and the PR. The owner wants to chart an idea with wayfinder and then let the SDLC playbook run through Matt's skills to a ready PR without being asked again. Today that takes three more commands and three more waits, each a gate whose answer is nearly always the recommended reading. ADR 0006 made the build unattended but kept the earlier gates interactive by nature. Evidence: both efforts run on this plugin so far passed every gate with every recommendation accepted.

## Outcome

A host chooses a **gate policy** in `forge.md`, `attended` or `autonomous`. Under `autonomous`, one `/forge-sdlc:wayfinder` invocation charts the map with the owner, then runs intent, spec, plan and build in the same run, printing each stage's report as it passes, and stops only where the artifacts say a human is needed: an `open:` line in the intent or the spec, a flagged concern in the spec, `risk: high` (that effort runs attended), and Gate 4, always. Gate 3's quiz answers itself with the recommended breakdown and records the four answers as `recommended:` lines in `plan.md` and the PR body, so the owner can overturn one at Gate 4. `wayfinder <slug>` resumes a stopped effort to its next stop the same way. `attended` is today's loop, unchanged, and the plugin's default.

Observable: on this repo with `policy: autonomous`, `/forge-sdlc:wayfinder <idea>` ends at Gate 4 with a PR body carrying the intent, the spec sections, the plan with its Quiz block, and the build evidence, with no prompt after charting unless one of the four stops fires.

## Users

The owner of a host who wants the loop to run to a PR after charting. The spec, plan and build stages, which learn to continue or stop by policy. Hosts on `attended`, who must notice nothing.

## Constraints

- Charting and every grilling ticket stay interactive under both policies: Matt's wayfinder forbids an agent answering its own interview, and autonomy starts only when the way is clear.
- Matt's skills stay unmodified; the frame substitutes the quiz's answerer under policy, as it already substitutes to-tickets' publish step.
- No hook changes: the policy lives in the skills, the state and the config; the hooks keep reading stages. Risk normal.
- A host with no `policy` key reads as `attended`; under `autonomous` the `spec: always | only-on-open` key is ignored.
- Every auto-passed gate leaves a record: the assumption lines, the Quiz block, the PR body.

## Open questions

none

## Decisions so far

- Grilling on 2026-10-19, eight questions, every recommendation accepted: one key `policy: attended | autonomous` under `## Gates`; four stops under autonomous (an `open:` line, a flagged concern, `risk: high` which makes the effort attended, Gate 4); charting and grilling tickets stay human; Gate 3 answers itself with the recommended answers, recorded as a `## Quiz` block of `recommended:` lines in `plan.md` and the PR body's Plan section; one run and one resume through wayfinder, with `effort-state` and `status` printing the policy and the stop; init asks `Policy: attended or autonomous?` leading with attended; **gate** redefined and **gate policy** added to the glossary; ADR 0006 superseded; no hooks touched.

## Out of scope

- Any automation of charting or of a grilling ticket.
- Passing Gate 4 automatically, or merging.
- Changing what a stage produces; only who passes its gate changes.

## Assumptions to confirm

- recommended: the Quiz block is `## Quiz` in `plan.md` after `## Prefactoring`, four `recommended:` lines in the quiz's order (granularity, blocking edges, merge or split, proofs), each `(source: policy autonomous)`, and the PR body's Plan section repeats them under the slice table (source: none)
- recommended: under `autonomous`, the run's stop is written to the effort's state as `stop: <reason>` beside `gate`, and `effort-state`'s `why` line reads it, so `status` and a resume name what stopped the run and the policy in force (source: none)
- recommended: `risk: high` is decided when intent.md is written, as today; under `autonomous` the Gate 1 report then says the effort runs attended from here, and the four gates follow as they do now (source: ADR 0006; design section 13, decision 6)
- recommended: the policy is read once per run from `forge.md` through `forge-config.mjs`, never cached in state; changing the key between runs changes the next resume (source: forge.md as the single host config)
- recommended: the build stage is unchanged: it is already unattended and ends at Gate 4; under `autonomous` wayfinder calls it after plan in the same run and prints its Gate 4 report (source: ADR 0006)
- recommended: the new ADR is 0018, "Gates pass by policy", and ADR 0006's status line becomes "superseded by 0018" with its text kept (source: CLAUDE.md Conventions)
- recommended: the eval scaffold's forge.md stays `attended`, so every existing eval keeps its gates; the autonomous path is proven by structural tests on the skills and `effort-state`, with no new eval case since no hook changes (source: intent Constraints)
- recommended: this repo's `forge.md` and videobot's set `policy: autonomous` by hand once the effort merges; the plugin's template ships `policy: attended` (source: grilling Q6)
