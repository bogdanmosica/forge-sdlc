---
effort: autonomous-gates
stage: spec
status: draft
risk: normal
updated: 2026-10-19
---

# Spec: Autonomous run after wayfinder

Intent: [intent.md](intent.md). Map: [map.md](map.md).

## Problem Statement

The owner of a host charts an idea with `/forge-sdlc:wayfinder`, answers every grilling question, and then has to come back three more times: once to accept the intent (Gate 1), once to approve the spec (Gate 2), and once to answer the plan quiz (Gate 3), before the unattended build runs to Gate 4. Each of those gates waits for a command and a human, and on this plugin the answer has nearly always been "yes, the recommended reading": both efforts run so far passed every gate with every recommendation accepted. ADR 0006 made the build unattended but kept the earlier gates interactive by nature, so the loop costs three extra commands and three extra waits even when nothing in the artifacts needs a human.

## Solution

A host chooses a **gate policy** in its host config, `forge.md`, under `## Gates`: `attended` (today's loop, unchanged, and the default) or `autonomous`. Under `autonomous`, one `/forge-sdlc:wayfinder <idea>` charts and works the map with the owner as today, then writes the intent and runs spec, plan and build in the same run, printing each stage's report as it passes. The run stops only where the artifacts say a human is needed:

- an `open:` assumption line in `intent.md` or `spec.md`;
- a flagged concern in `spec.md`;
- `risk: high`, which makes that effort run attended from Gate 1 on;
- Gate 4, always the owner's.

At Gate 3 the quiz answers itself with the recommended breakdown, and the four answers are recorded as `recommended:` lines in a `## Quiz` block of `plan.md` and under the slice table in the PR body's `## Plan`, so the owner can overturn one at Gate 4. A stopped effort resumes with `wayfinder <slug>` to its next stop the same way. `effort-state` and `status` print the policy in force and name what stopped the run. Every gate the policy passes leaves a record: the assumption lines, the Quiz block, the PR body.

## User Stories

1. As a host owner, I want to set `policy: autonomous` under `## Gates` in `forge.md`, so that the loop runs from a clear map to a ready PR without asking me again.
2. As a host owner, I want a host with no `policy` key to behave as `attended`, so that upgrading the plugin changes nothing until I opt in.
3. As a host owner on `attended`, I want every gate, prompt and report to stay exactly as it is today, so that the new policy costs me nothing.
4. As a host owner, I want `/forge-sdlc:init` to ask `Policy: attended or autonomous?` in its Gates question, leading with attended, so that a new host chooses its policy at setup.
5. As a host owner re-running init, I want the policy question to lead with my current value, so that a re-run keeps my choice unless I change it.
6. As a host owner, I want the plugin's config template to ship `policy: attended`, so that the default is written down rather than implied.
7. As a host owner on `autonomous`, I want charting and every grilling ticket to stay interactive, so that I still answer my own interview and the agent never answers for me.
8. As a host owner on `autonomous`, I want the run to continue from charting into intent, spec, plan and build in one `/forge-sdlc:wayfinder` invocation, so that I type one command per effort.
9. As a host owner on `autonomous`, I want each stage's report printed as the stage passes, so that I can follow the run and see what each gate decided.
10. As a host owner on `autonomous`, I want Gate 1 to pass on its own when `intent.md` has no `open:` line and the effort is `risk: normal`, so that a clear intent flows into spec.
11. As a host owner on `autonomous`, I want the run to stop at Gate 1 when `intent.md` has an `open:` line, so that only I settle a question no artifact answers.
12. As a host owner on `autonomous`, I want Gate 2 to pass on its own when the spec has no `open:` line, no flagged concern and normal risk, so that a clean spec flows into plan.
13. As a host owner on `autonomous`, I want the run to stop at Gate 2 when the spec has an `open:` line or a flagged concern, so that a policy skill's unresolved concern reaches me before any code is written.
14. As a host owner on `autonomous`, I want the `spec: always | only-on-open` key ignored, so that the policy alone decides who passes Gate 2.
15. As a host owner on `attended`, I want the `spec:` key to keep its meaning, so that `only-on-open` still lets a clean spec flow into plan.
16. As a host owner on `autonomous`, I want an effort whose intent is `risk: high` to run attended from Gate 1 on, with the Gate 1 report saying so, so that risky work keeps every human gate.
17. As a tech lead, I want a `risk: high` effort to keep stopping at Gate 2 with the `needs-tech-lead` label under both policies, so that the risk gate is never auto-passed.
18. As an engineer on `autonomous`, I want Gate 3's quiz answered with the recommended breakdown (granularity, blocking edges, merge or split, proofs), so that a clean plan flows into build.
19. As an engineer, I want the four quiz answers recorded as a `## Quiz` block of `recommended:` lines in `plan.md` after `## Prefactoring`, each `(source: policy autonomous)`, so that the auto-passed gate leaves a record in git.
20. As a code owner, I want the PR body's `## Plan` to repeat the Quiz lines under the slice table, so that I can review and overturn a quiz answer at Gate 4 without opening `plan.md`.
21. As an engineer on `attended`, I want the quiz asked through the dialog as today and no Quiz block written, so that my plan.md is unchanged.
22. As a host owner on `autonomous`, I want build to start right after plan in the same run and end at Gate 4 with its usual report, so that the run ends with a ready PR.
23. As a code owner, I want Gate 4 to stay mine under both policies, so that nothing merges and no PR is marked reviewed without a human.
24. As a host owner, I want the run's stop written to the effort's state as `stop: <reason>` beside `gate`, so that the reason survives the session.
25. As a host owner, I want `wayfinder <slug>` on a stopped effort to resume and run to the next stop under the same policy, so that settling one question does not cost me one command per remaining gate.
26. As a host owner, I want a resume to read the policy from `forge.md` on that run, so that switching the key between runs changes the next resume.
27. As a host owner, I want `effort-state` to print the policy in force and the stop, so that a script or a resume knows why the effort waits.
28. As a host owner, I want `/forge-sdlc:status` to print the policy and name what stopped the run in each effort's first line, so that I see at a glance which efforts wait for me and why.
29. As a host owner, I want an effort whose state was lost to still resume from its artifacts, with the policy read from `forge.md`, so that losing `.forge/state.json` stays recoverable.
30. As a host owner, I want a run that ended between two policy-passed gates (session closed, context exhausted) to resume from the last stage written to state, so that an interrupted autonomous run continues where it stopped.
31. As a host owner reading the PR at Gate 4, I want the intent, the spec sections, the plan with its Quiz block and the build evidence all in the PR body, so that I can reconstruct every decision the policy took.
32. As a stage (spec, plan), I want one reference that states the stop rule, the stop reasons, the report line and the state write, so that every stage applies the same policy the same way.
33. As wayfinder's resume, I want each policy-passed stage to report `Gate <n> passed: ...`, so that the chain continues on a fixed report line as it does today after spec.
34. As a plugin maintainer, I want no hook script changed, so that the hooks keep reading stages and the effort stays `risk: normal`.
35. As a plugin maintainer, I want the eval scaffold's `forge.md` to stay `attended`, so that every existing eval keeps its gates and passes unchanged.
36. As a plugin maintainer, I want ADR 0018 "Gates pass by policy" to supersede ADR 0006, with 0006's text kept, so that the decision history reads in order.
37. As a plugin maintainer, I want the design, contracts, glossary and README to describe the gate policy and the four stops, so that the docs match the skills.
38. As the owner of this repo and of videobot, I want to set `policy: autonomous` by hand once the effort merges, so that the plugin's own default stays `attended`.

## Implementation Decisions

**The gate policy (host config).** One new bullet, `policy: attended | autonomous`, under `## Gates` of the host config. The generic config parser and `forge-config` already print it as `gates.policy`; neither changes. A missing key, and any value other than `autonomous`, reads as `attended`. The policy is read once per run, never cached in state. Under `autonomous` the `spec:` key is ignored; it stays in the file so a host that switches back to `attended` reads it.

**The gate policy reference (new, beside the wayfinder skill).** One short reference file, linked from wayfinder (step 7 and Resume), spec (step 7) and plan (step 3), in the way every dispatching skill links the member-call reference. It is the single source for:

- **The stop rule.** Under `autonomous`, a gate passes by policy when its artifact has no `open:` line, the spec (at Gate 2) has no flagged concern other than `- none`, and the effort is `risk: normal`. Otherwise the run stops at that gate. Gate 4 always stops. Under `attended`, every gate stops as today; Gate 2 keeps its `spec:` key rule.
- **The stop reasons**, a closed set written to state: `open` (an `open:` line in intent.md or spec.md), `flagged` (a flagged concern in spec.md), `risk-high` (the effort runs attended). When more than one holds, the first in that order is written and the report names all of them.
- **The report line** of a gate the policy passed: `Gate <n> passed: policy autonomous, nothing open`. A stopped gate reports its reasons and the resume command, as today.
- **The state write**: a stage that stops by policy writes `stop: <reason>` beside `gate`. Every other stage state write drops `stop`.

**wayfinder (the run and the resume).**

- Step 1 reads the policy from the printed host config along with the default branch and the risk globs.
- Step 7, under `autonomous` with a policy-passed Gate 1: print the Gate 1 report with the `Gate 1 passed` line, then continue as Resume step 3 with `spec` as next, in the same run. Under `autonomous` with a stop: write `stop`, report the reasons; for `risk-high` the report says the effort runs attended from here. Under `attended`: unchanged.
- Resume step 3 continues past every gate whose stage reports `Gate <n> passed` (1, 2 or 3), taking the next stage from `effort-state`, and ends at the first stop or at Gate 4. The existing `Gate 2 passed` continuation is the attended `only-on-open` case of the same rule. Each next stage is still read by file when it is reached (ADR 0009), so a stage's steps enter the run's context only when that stage starts.
- The front-door description gains one clause for the autonomous run; the skill stays user-invoked.

**spec.** Step 1's acceptance of Gate 1 (`status: accepted` in intent.md) is made by the human typing the command or by the policy passing Gate 1. Step 7 applies the stop rule through the reference: under `autonomous` the `spec:` key is not consulted. The `risk: high` stop and the `needs-tech-lead` label are unchanged under both policies.

**plan.**

- Step 1's precondition accepts a Gate 2 passed by the policy as it accepts the human's command.
- Step 3, under `autonomous` with `risk: normal`: the quiz's answer is the drafted breakdown, approved as drafted. The four answers (granularity, blocking edges, merge or split, proofs, in that order) are written as `recommended:` lines with `(source: policy autonomous)`. Under `attended`, or for a `risk: high` effort: the dialog quiz as today.
- Step 5 writes a `## Quiz` section after `## Prefactoring` holding the four lines, under `autonomous` only.
- Step 6 writes the same four lines under the slice table in the PR body's `## Plan`.
- Step 7's report gains the `Gate 3 passed` line under `autonomous`, which resume reads to continue into build.

**PLAN-TEMPLATE.** Gains a `## Quiz` section after `## Prefactoring`, marked as written under the autonomous gate policy only.

**build.** Unchanged. It is already unattended and ends at Gate 4; under `autonomous` wayfinder reaches it after plan in the same run, and its Gate 4 report ends the run. Gate 4 writes no `stop`: `gate: pr` already names it.

**effort-state (interface change).** The printed object gains two fields: `{ slug, stage, gate, next, why, source, policy, stop }`.

- `policy` is the host's gate policy read from the config on each call, `attended` by default.
- `stop` is the state's `stop`, or `none` when absent or when `source` is `artifacts`.
- When `stop` is set, `why` names it in place of the stage's line (an open line waits for the owner; a flagged concern waits for the owner; risk high, the effort runs attended).
- `next` is unchanged, and so are the NEXT table and `--list`, whose entries carry the same two fields.
- The default `attended` is applied inside this script, not in the shared hook library.

**status.** Each effort's first line gains `policy <policy>` and, when set, `stopped: <stop>`. Behaviour is otherwise unchanged and the skill stays read-only.

**init.** Question 4 (Gates) asks `Policy: attended or autonomous?` first, leading with `attended` (the current value on a re-run), then `spec` and `max_parallel_slices` as today. FORGE-TEMPLATE gains `- policy: attended   # or: autonomous` under `## Gates`.

**State schema (contracts).** The effort record gains an optional `stop: "open" | "flagged" | "risk-high"`. It is additive: absent reads as none and no migration runs. The Names row for the effort position adds `policy` and `stop`. The PR body table's `## Plan` row adds the Quiz lines under autonomous.

**Docs.**

- **ADR 0018, "Gates pass by policy":** the four stops, the self-answered quiz, one run and one resume, attended as default. ADR 0006's status line becomes `superseded by 0018`, its text kept.
- **design.md:**
  - Section 3: the loop text and the gate diagram say who passes a gate under each policy.
  - Section 4: the gate table names the policy pass and the Quiz block.
  - Section 5: the wayfinder, spec and plan subsections, and a `Decision:` line pointing at ADR 0018.
  - Section 8: the `policy` bullet in the config example.
  - Section 9: `stop` in the state line.
  - Section 13: item 6 is reworded to the new decision.
- **README:** the loop table's Gate column and one paragraph on the policy.
- **Glossary:** already carries **gate** and **gate policy**, so no further term is added.

**Risk boundary.** No file under this repo's `risk.high` globs changes: no hook script, no shared hook library, no plugin or marketplace manifest. The effort stays `risk: normal`.

## Testing Decisions

- A good test drives a module through its interface and asserts what a caller observes: the JSON `effort-state` prints for a fixture host, or the text a skill or template carries that the next reader (the agent, the resume, a test) depends on. A good test does not assert how the script computes the value.
- **Seam 1, `effort-state`'s printed JSON (existing, the one behavioural seam).** Fixture hosts built by the existing host helper, which already accepts a `forge.md` text, with state written by `writeState`. Cases:
  - no `policy` key prints `policy: attended`;
  - `policy: autonomous` prints `autonomous`;
  - an unknown value prints `attended`;
  - a state `stop` of each reason prints that `stop` and a `why` naming it, with `next` unchanged;
  - no `stop` prints `stop: none` and today's `why`;
  - `source: artifacts` prints `stop: none` and the config's policy;
  - `--list` entries carry both fields.

  Prior art: the existing effort-state tests (state decides, artifacts decide, `--list`).
- **Seam 2, the skill and template text (existing structural tests per skill).** Prior art: the wayfinder, spec, plan, init and status tests and the docs/contracts tests. These tests extend to assert:
  - wayfinder step 7 and Resume link the gate policy reference and continue on `Gate <n> passed` to the first stop or Gate 4;
  - spec step 7 and plan step 3 link the reference;
  - the reference names the four stops, the three stop reasons, the report line and the state write;
  - plan step 3 keeps the dialog quiz under attended and writes the Quiz lines with `(source: policy autonomous)` under autonomous;
  - PLAN-TEMPLATE carries `## Quiz` after `## Prefactoring`;
  - init asks the policy in Gates leading with attended, and FORGE-TEMPLATE carries `policy: attended`;
  - status prints the policy and the stop;
  - contracts carries `stop` in the state shape;
  - every changed numbered step still ends on a `Done when` line;
  - every relative link resolves.
- **The config parse.** One case in the config tests: a host written from the template prints `gates.policy` as `attended` through `forge-config`.
- **Evals.** No new eval case, since no hook changes. The eval scaffold's `forge.md` stays `attended`, so every existing case, including `build-three-slices`, passes unchanged. `npm test` and `npm run validate` stay green.
- The observable end-to-end check, `/forge-sdlc:wayfinder <idea>` on this repo with `policy: autonomous` ending at Gate 4 with no prompt after charting, is the owner's live check after merge, not an automated test.

## Out of Scope

- Any automation of charting or of a grilling ticket.
- Passing Gate 4 automatically, or merging.
- Changing what a stage produces: only who passes its gate changes. The spec-writer, to-tickets' breakdown, the build and slice-review are untouched.
- Any hook script, the shared hook library, the plugin and marketplace manifests.
- A new eval case or a change to the eval scaffold's gates.
- An undo path for an overturned Quiz line beyond the existing ones (comment, edit, rerun a stage by hand).
- Setting `policy: autonomous` on this repo or videobot, which the owner does by hand after merge.
- The member-call finding under Further Notes.

## Further Notes

- The chain words matter (ADR 0009): resume continues on a stage's `Gate <n> passed` line. Changing that wording in the gate policy reference means changing wayfinder's Resume and its test with it.
- A full autonomous run holds charting, spec, plan and the build's lead work in one session. State is written at every stage boundary, so a run that ends early (session closed, context compacted or exhausted) resumes with `wayfinder <slug>` from the last stage written. A gate the policy passed but whose next stage never started reads as that gate in `effort-state` with `stop: none`.
- Per the `writing-for-agents` policy skill, the stop rule lives in one reference rather than in three skills, and plan's autonomous branch is written as the positive action (the answers are the recommended breakdown) rather than as a ban on the dialog.
- Finding recorded, not fixed by this effort. The member-call reference says the lead makes the same named Agent call under a plain lead and a teams lead. Under a plain lead the Agent tool has no `name` parameter at all, so a plain lead cannot pass the name, rather than passing it and having it ignored. The reference's wording and ADR 0017's "under a plain lead the subagent it always was" should be revisited in a later effort.
- Design section 14, question 5 (spec gate default `always`) still holds for attended hosts. Under autonomous the `spec:` key is set aside, which is the owner's explicit opt-in.

## Affected users and systems

- Host owner on `autonomous`: one `/forge-sdlc:wayfinder` per effort runs from charting to Gate 4. The owner is asked again only on an `open:` line, a flagged concern or `risk: high`, and reviews the Quiz lines at Gate 4.
- Host owner on `attended` (the default): no change in gates, prompts or reports. `status` and `effort-state` additionally print `policy attended`.
- Engineer: under `autonomous` the plan quiz is no longer asked. The four answers are recorded in `plan.md` and the PR body for review at Gate 4.
- Code owner: Gate 4 unchanged. The PR body's `## Plan` gains the Quiz lines under autonomous.
- Tech lead: `risk: high` efforts keep every gate and the `needs-tech-lead` label under both policies.
- Host config (`forge.md`): migrates. It gains `policy` under `## Gates` through init or by hand, and the template ships `attended`.
- `forge-config`: is called by wayfinder, spec and plan to read `gates.policy`. Unchanged.
- wayfinder skill: reads the policy and calls spec, plan and build by file in one run under autonomous. Writes `stop` to state.
- Gate policy reference (new): is read by wayfinder, spec and plan.
- spec skill: reads the policy and writes `stop` to state. Its Gate 2 rule depends on the policy.
- plan skill and PLAN-TEMPLATE: write the `## Quiz` block to `plan.md` and the PR body's `## Plan` under autonomous, and write `stop` to state.
- build skill: is called by wayfinder after plan in the same run. Unchanged.
- status skill: reads `policy` and `stop` from `effort-state` and prints them.
- init skill and FORGE-TEMPLATE: write `policy` to `forge.md`.
- `effort-state`: reads `gates.policy` from the host config and `stop` from state. Its printed interface gains `policy` and `stop`.
- `.forge/state.json`: migrates additively. The effort record gains an optional `stop`.
- PR body or `PR.md`: written by plan with the Quiz lines under `## Plan`.
- Hooks and the shared hook library: unchanged. They keep reading `stage` and `gate`.
- Eval suites: unchanged. The scaffold stays `attended`.
- Docs (ADR 0006, new ADR 0018, design sections 3, 4, 5, 8, 9 and 13, contracts, README): written to describe the policy.
- Tests: the effort-state, config, wayfinder, spec, plan, init and status tests are extended.

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
