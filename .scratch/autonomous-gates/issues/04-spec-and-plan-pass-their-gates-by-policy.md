# 04: autonomous-gates-04: spec and plan pass their gates by policy

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Spec: `docs/efforts/autonomous-gates/spec.md` on `feat/autonomous-gates`

**What to build:** The spec and plan stages pass their gates by policy. Spec step 1 accepts Gate 1 passed by the policy as it accepts the human's command; step 7 applies the stop rule through the gate policy reference, not consulting the `spec:` key under autonomous; the `risk: high` stop and the `needs-tech-lead` label stay under both. Plan step 1 accepts a policy-passed Gate 2; step 3, under autonomous with `risk: normal`, takes the drafted breakdown as the quiz's answer and writes the four answers (granularity, blocking edges, merge or split, proofs) as `recommended:` lines with `(source: policy autonomous)`, keeping the dialog quiz under attended and for a risk-high effort; step 5 writes `## Quiz` after `## Prefactoring` in plan.md under autonomous only; step 6 repeats the four lines under the slice table in the PR body's Plan section; step 7 reports `Gate 3 passed` under autonomous. PLAN-TEMPLATE gains the `## Quiz` section marked as autonomous-only. Both skills link the reference.

**Blocked by:** 03 (Gate policy reference and wayfinder's one run)

- [ ] Spec step 7 and plan step 3 link the reference; spec step 7 applies the stop rule under autonomous without the `spec:` key
- [ ] Plan keeps the dialog quiz under attended and writes the four Quiz lines with `(source: policy autonomous)` under autonomous; the Gate 3 passed line is reported
- [ ] PLAN-TEMPLATE carries `## Quiz` after `## Prefactoring`; the contracts' PR body table notes the Quiz lines under the Plan row
- [ ] Every changed numbered step ends on a Done line; every relative link resolves

## Proof

`node --test tests/spec.test.mjs tests/plan.test.mjs` → passes with the policy rules and the Quiz block

## Assumptions

- recommended: spec step 6 and plan step 6 drop `stop` on their state write, and only spec step 7 writes `stop: <reason>` on an autonomous stop; plan writes none, since under `autonomous` a `risk: high` effort already stopped at Gate 1 and Gate 3 then asks the dialog quiz (source: spec Implementation Decisions, "Every other stage state write drops `stop`")
- recommended: the carried nit from review 03 is fixed here: the `open` reason in GATE-POLICY.md and in contracts' `stop` line now names `plan.md` too, matching the stop rule's Gate 3 artifact (source: GATE-POLICY.md stop rule; .forge/review/autonomous-gates-03.md)
- recommended: each Quiz line reads `- recommended: <question>: <answer> (source: policy autonomous)`, the question named first so a reviewer at Gate 4 sees which answer it is (source: spec user story 19)
- recommended: under `autonomous`, a stopped Gate 2 reports its reasons and `/forge-sdlc:wayfinder <slug>` to resume instead of `/forge-sdlc:plan <slug>` (source: GATE-POLICY.md Report line)
