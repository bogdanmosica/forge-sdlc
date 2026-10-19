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

## Assumptions to confirm

- recommended: the Quiz block is `## Quiz` in `plan.md` after `## Prefactoring`, four `recommended:` lines in the quiz's order (granularity, blocking edges, merge or split, proofs), each `(source: policy autonomous)`, and the PR body's Plan section repeats them under the slice table (source: none)
- recommended: under `autonomous`, the run's stop is written to the effort's state as `stop: <reason>` beside `gate`, and `effort-state`'s `why` line reads it, so `status` and a resume name what stopped the run and the policy in force (source: none)
- recommended: `risk: high` is decided when intent.md is written, as today; under `autonomous` the Gate 1 report then says the effort runs attended from here, and the four gates follow as they do now (source: ADR 0006; design section 13, decision 6)
- recommended: the policy is read once per run from `forge.md` through `forge-config.mjs`, never cached in state; changing the key between runs changes the next resume (source: forge.md as the single host config)
- recommended: the build stage is unchanged: it is already unattended and ends at Gate 4; under `autonomous` wayfinder calls it after plan in the same run and prints its Gate 4 report (source: ADR 0006)
- recommended: the new ADR is 0018, "Gates pass by policy", and ADR 0006's status line becomes "superseded by 0018" with its text kept (source: CLAUDE.md Conventions)
- recommended: the eval scaffold's forge.md stays `attended`, so every existing eval keeps its gates; the autonomous path is proven by structural tests on the skills and `effort-state`, with no new eval case since no hook changes (source: intent Constraints)
- recommended: this repo's `forge.md` and videobot's set `policy: autonomous` by hand once the effort merges; the plugin's template ships `policy: attended` (source: grilling Q6)
