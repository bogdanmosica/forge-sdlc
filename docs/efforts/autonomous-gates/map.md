---
effort: autonomous-gates
stage: map
status: draft
risk: normal
updated: 2026-10-19
---

# Autonomous run after wayfinder

## Destination

### Problem

The loop stops at four human gates: intent, spec, the plan quiz, and the PR. The owner wants to chart an idea with wayfinder and then let the SDLC playbook run through Matt's skills to a ready PR without being asked again. Today that takes three more commands and three more waits, each a gate whose answer is nearly always "yes, the recommended reading". ADR 0006 made the build unattended but kept the earlier gates interactive by nature.

### Outcome

A host chooses a **gate policy** in `forge.md`, `attended` or `autonomous`. Under `autonomous`, one `/forge-sdlc:wayfinder` invocation charts the map with the owner, then runs intent, spec, plan and build in the same run, printing each stage's report as it passes, and stops only where the artifacts say a human is needed: an `open:` line in the intent or the spec, a flagged concern in the spec, `risk: high` (that effort runs attended), and Gate 4, always. Gate 3's quiz answers itself with the recommended breakdown and records the four answers as `recommended:` lines in `plan.md` and the PR body, so the owner can overturn one at Gate 4. `wayfinder <slug>` resumes a stopped effort to its next stop the same way. `attended` is today's loop, unchanged, and the plugin's default.

Observable: on this repo with `policy: autonomous`, `/forge-sdlc:wayfinder <idea>` ends at Gate 4 with a PR body carrying the intent, the spec sections, the plan with its Quiz block, and the build evidence, with no prompt after charting unless one of the four stops fires.

### Users

The owner of a host who wants the loop to run to a PR after charting. The spec, plan and build stages, which learn to continue or stop by policy. Hosts on `attended`, who must notice nothing.

### Constraints

- Charting and every grilling ticket stay interactive under both policies: Matt's wayfinder forbids an agent answering its own interview, and autonomy starts only when the way is clear.
- Matt's skills stay unmodified; the frame substitutes the quiz's answerer under policy, as it already substitutes to-tickets' publish step.
- No hook changes: the policy lives in the skills, the state and the config; the hooks keep reading stages. Risk normal.
- A host with no `policy` key reads as `attended`; under `autonomous` the `spec: always | only-on-open` key is ignored.
- Every auto-passed gate leaves a record: the assumption lines, the Quiz block, the PR body.

### Open questions

none

## Notes

Engineering, in this plugin. Sessions read `docs/design.md` sections 3 and 4 (the loop and the gates), ADR 0006, `GLOSSARY.md`, and the skills wayfinder, spec, plan, build, status and init. Skills to consult: `mattpocock-skills:writing-for-agents` for every skill edit. Standing preference: the autonomous path adds nothing a human cannot reconstruct from the PR body.

## Decisions so far

- Destination settled by grilling on 2026-10-19, eight questions, every recommendation accepted:
  - One key, `policy: attended | autonomous` under `## Gates`; `spec:` keeps its meaning for attended hosts and is ignored under autonomous.
  - Four stops under autonomous: an `open:` line (intent or spec), a flagged concern (spec), `risk: high` (the effort runs attended), Gate 4.
  - Charting and grilling tickets stay human under both policies.
  - Gate 3 answers itself with the recommended answers, recorded as a `## Quiz` block of `recommended:` lines in `plan.md` and in the PR body's Plan section.
  - One run, one resume: wayfinder runs intent, spec, plan and build in one invocation and resumes to the next stop; `effort-state` and `status` print the policy and name what stopped the run.
  - Init asks `Policy: attended or autonomous?` under Gates, leading with attended; this repo and videobot set autonomous by hand.
  - Glossary: **gate** redefined as a point where the effort waits for a decision, the owner's under attended or the policy's when the artifact is complete; **gate policy** added. ADR 0006 superseded by the new ADR carrying the four stops.
  - Scope: skill text (wayfinder, spec, plan, init, status), `effort-state.mjs`, the template, design, glossary, README, tests. No hooks.

## Not yet specified

none: the way is clear.

## Out of scope

- Any automation of charting or of a grilling ticket.
- Passing Gate 4 automatically, or merging.
- Changing what a stage produces; only who passes its gate changes.
