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

## Comments

red: no fresh green verify record at slice head aeba516 (the record on file is for 394098e). Two verifier runs hung with about 28 node --test processes and were killed; suspect a test added in 059befd. Round 1 left one Standards Important (plan step 6 restating the reference), which aeba516 addresses but unreviewed. Findings: .forge/review/autonomous-gates-04.md. The slice branch and worktree stay for the implementer.
