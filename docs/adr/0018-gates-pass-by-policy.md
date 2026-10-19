# 18. Gates pass by policy

Status: accepted, 2026-10-19

## Context

ADR 0006 made the build unattended between Gate 3 and Gate 4 and kept the earlier gates interactive by nature. A host owner who charts an idea with `/forge-sdlc:wayfinder` then comes back three more times: to accept the intent (Gate 1), approve the spec (Gate 2) and answer the plan quiz (Gate 3). On this plugin's own efforts the answer was nearly always "yes, the recommended reading", so the three waits cost commands and time even when nothing in the artifacts needed a human. The artifacts already say where a human is needed: an `open:` assumption line, a flagged concern, `risk: high`.

## Decision

A host chooses a **gate policy** under `## Gates` in `docs/agents/forge.md`: `policy: attended | autonomous`. A missing key, or any value other than `autonomous`, reads as `attended`, the default, under which every gate stops for the owner as before. This supersedes ADR 0006, whose unattended build stands; what changes is who passes Gates 1 to 3.

- Under `autonomous`, a gate passes by policy when its artifact has no `open:` line, the spec has no flagged concern other than `- none`, and the effort is `risk: normal`. The run stops in four places only: an `open:` line, a flagged concern, `risk: high` (the effort then runs attended from Gate 1 on), and Gate 4, which is always the code owner's.
- Charting and every grilling ticket stay interactive; the policy passes gates, it never answers the owner's interview.
- One `/forge-sdlc:wayfinder <idea>` charts and works the map with the owner, then writes the intent and runs spec, plan and build in the same run, each stage read by file when it starts (ADR 0009). A gate the policy passed reports `Gate <n> passed: policy autonomous, nothing open`, and wayfinder's resume continues on that line to the first stop or Gate 4. A stopped effort resumes with `wayfinder <slug>` to its next stop the same way.
- At Gate 3 the plan quiz answers itself with the drafted breakdown; its four answers are written as `recommended:` lines with `(source: policy autonomous)` in a `## Quiz` block of `plan.md` and under the slice table in the PR body, so the owner can overturn one at Gate 4.
- A run that stops writes `stop: open | flagged | risk-high` beside `gate` in the effort's state (design section 9); every other stage write drops it, and Gate 4 writes none. The policy itself is read from `forge.md` on every run (design section 8), never cached in state.
- Under `autonomous` the `spec: always | only-on-open` key is ignored; it stays in the file for a host that switches back.
- The stop rule, the stop reasons, the report line and the state write live in one reference, `skills/wayfinder/GATE-POLICY.md`, linked by wayfinder, spec and plan.

## Consequences

- An autonomous host types one command per effort and is asked again only where an artifact says a human is needed; every gate the policy passed leaves its record in git and the PR body (assumption lines, the Quiz block).
- An attended host sees no change in its gates, prompts or reports; `effort-state` and `status` additionally print the policy in force and the stop.
- `risk: high` work keeps every human gate and the `needs-tech-lead` label under both policies. No hook reads the policy: the hooks keep reading `stage` and `gate`.
- A full autonomous run holds charting, spec, plan and the build's lead work in one session. State is written at every stage boundary, so a run that ends early resumes from the last stage written.
- The chain words matter: renaming the `Gate <n> passed` line means changing wayfinder's resume and its test with it.
