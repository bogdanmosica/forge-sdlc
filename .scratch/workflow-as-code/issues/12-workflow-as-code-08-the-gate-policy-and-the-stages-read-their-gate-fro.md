# 12: workflow-as-code-08: The gate policy and the stages read their gate from the workflow

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** `GATE-POLICY.md` stays the one place the rule is stated: each gate's mode, source and stops read once per run from `bin/workflow.mjs --gate <key>`; mode `policy` passes on a clear stop rule, `attended` stops; the stop-reasons table names `plan.md` for `open` and gains `attended` last; the state write covers `attended` from forge.yaml; the report line keeps `Gate <n> passed:` and `, nothing open` with its middle naming the source (`policy autonomous`, `gates.<key> policy`, `only-on-open`). Wayfinder, spec and plan reduce their gate section to one pointer line plus their gate key, artifact and next command, and choose by the gate's mode; build reads `max_parallel_slices` from `bin/workflow.mjs`; status keeps printing the why

**Blocked by:** workflow-as-code-04, workflow-as-code-05

- [ ] GATE-POLICY.md: `attended` last in the closed set, `plan.md` for `open`, the three report-line tails
- [ ] each of wayfinder, spec and plan reads its gate through `bin/workflow.mjs --gate` and points to GATE-POLICY.md
- [ ] the plan quiz lines end `(source: <tail>)`
- [ ] build reads `max_parallel_slices` from `bin/workflow.mjs`, not forge-config
- [ ] wayfinder's Resume still continues on `Gate <n> passed`; the existing stage text tests updated and green

## Proof

```sh
node --test tests/workflow-stages.test.mjs tests/wayfinder.test.mjs tests/spec.test.mjs tests/plan.test.mjs tests/build.test.mjs tests/status.test.mjs
```

passes: the stage gate checks and the existing stage text tests green
