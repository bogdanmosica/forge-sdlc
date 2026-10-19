# Autonomous run after wayfinder

## Intent

### Problem

The loop stops at four human gates: intent, spec, the plan quiz, and the PR. The owner wants to chart an idea with wayfinder and then let the SDLC playbook run through Matt's skills to a ready PR without being asked again. ADR 0006 made the build unattended but kept the earlier gates interactive.

### Outcome

A host chooses a gate policy in `forge.md`, `attended` or `autonomous`. Under `autonomous`, one wayfinder invocation charts the map with the owner, then runs intent, spec, plan and build in the same run and stops only on an `open:` line, a flagged concern, `risk: high` (the effort runs attended) or Gate 4. Gate 3's quiz answers itself and records the answers as `recommended:` lines. `attended` is today's loop and the default.

### Users

The owner of a host who wants the loop to run to a PR after charting; the stages that learn to continue or stop by policy; attended hosts, who notice nothing.

### Constraints

Charting and grilling stay human. Matt's skills unmodified; the frame substitutes the quiz's answerer. No hook changes, risk normal. No `policy` key reads as attended; under autonomous the `spec:` key is ignored. Every auto-passed gate leaves a record.

### Open questions

none

## Spec

[spec.md](spec.md) on `feat/autonomous-gates`: 38 user stories. Risk normal.

## Flagged concerns

- none

## Assumptions to confirm

- recommended: the Quiz block is `## Quiz` in `plan.md` after `## Prefactoring`, four `recommended:` lines in the quiz's order (granularity, blocking edges, merge or split, proofs), each `(source: policy autonomous)`, and the PR body's Plan section repeats them under the slice table (source: none)
- recommended: under `autonomous`, the run's stop is written to the effort's state as `stop: <reason>` beside `gate`, and `effort-state`'s `why` line reads it, so `status` and a resume name what stopped the run and the policy in force (source: none)
- recommended: `risk: high` is decided when intent.md is written, as today; under `autonomous` the Gate 1 report then says the effort runs attended from here, and the four gates follow as they do now (source: ADR 0006; design section 13, decision 6)
- recommended: the policy is read once per run from `forge.md` through `forge-config.mjs`, never cached in state; changing the key between runs changes the next resume (source: forge.md as the single host config)
- recommended: the build stage is unchanged: it is already unattended and ends at Gate 4; under `autonomous` wayfinder calls it after plan in the same run and prints its Gate 4 report (source: ADR 0006)
- recommended: the new ADR is 0018, "Gates pass by policy", and ADR 0006's status line becomes "superseded by 0018" with its text kept (source: CLAUDE.md Conventions)
- recommended: the eval scaffold's forge.md stays `attended`, so every existing eval keeps its gates; the autonomous path is proven by structural tests on the skills and `effort-state`, with no new eval case since no hook changes (source: intent Constraints)
- recommended: this repo's `forge.md` and videobot's set `policy: autonomous` by hand once the effort merges; the plugin's template ships `policy: attended` (source: grilling Q6)
- recommended: the seams are the two existing ones, `effort-state`'s printed JSON for behaviour and the per-skill structural tests for skill and template text; no new seam is introduced (source: docs/contracts.md Tests; tests/effort-state.test.mjs)
- recommended: the stop rule, the stop reasons, the `Gate <n> passed` report line and the state write live in one gate policy reference beside the wayfinder skill, linked from wayfinder, spec and plan (source: writing-for-agents single source of truth; ADR 0017's one member-call reference as precedent)
- recommended: the stop reasons are the closed set `open`, `flagged`, `risk-high`, first in that order written when several hold; Gate 4 writes no `stop` since `gate: pr` names it; every other stage state write drops `stop`; the field is additive with no migration (source: docs/contracts.md, additive state fields)
- recommended: `effort-state` prints `{ slug, stage, gate, next, why, source, policy, stop }`: `policy` is the host's (`attended` unless the key reads exactly `autonomous`), `stop` is the state's or `none`, always `none` when `source` is `artifacts`; `next` and the NEXT table are unchanged (source: intent Decisions so far; docs/contracts.md effort position row)
- recommended: for a `risk: high` effort under an autonomous host, `effort-state` prints the host's policy and the `risk-high` stop names that the effort runs attended (source: GLOSSARY.md gate policy)
- recommended: a gate passed by policy reports `Gate <n> passed: policy autonomous, nothing open` (n = 1, 2, 3), and wayfinder's resume continues on that line to the first stop or Gate 4, generalising today's `Gate 2 passed` continuation (source: ADR 0009 consequences)
- recommended: the default `attended` is applied in `effort-state` and the skills, never in the shared hook library, so no file under the host's `risk.high` globs changes and the effort stays `risk: normal` (source: docs/agents/forge.md Risk; intent Constraints)
- recommended: init asks the policy first in the Gates question and still asks and writes `spec:` under both policies, so a host switching back to `attended` reads its old value (source: intent Constraints, the key is ignored, not removed)
- recommended: `status` prints `policy <policy>` for every host, including attended ones, whose gates, prompts and reports are otherwise unchanged (source: intent Decisions so far, "effort-state and status print the policy")
- recommended: no new glossary term; `stop` is used in its plain sense and the stops are named in the existing **gate policy** entry (source: GLOSSARY.md)
- recommended: wayfinder's description gains one clause for the autonomous run and the skill stays user-invoked (source: writing-for-agents context pointers; docs/contracts.md Skills)
- recommended: overturning a Quiz line at Gate 4 uses the existing paths (a PR comment, an edit, a stage rerun by hand); this effort adds no undo path (source: intent Out of scope)
