# 14: workflow-as-code-10: Init writes workflow: to forge.yaml

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** Init's Gates question asks the global policy, then under `attended` whether Gate 2 passes by policy, then `max_parallel_slices`, and writes `workflow.policy` and `workflow.max_parallel_slices` always and `workflow.gates.spec: policy` only when chosen to forge.yaml, keeping every other key; a re-run leads with the current `workflow:` values, else the `## Gates` bullets; the forge.md template drops `## Gates`; the frame evals' host fixture (`evals/lib/host.sh`) writes `workflow:` instead

**Blocked by:** workflow-as-code-01

- [ ] init's text writes `workflow:` and keeps other forge.yaml keys
- [ ] the template has no `## Gates`
- [ ] re-run leads with `workflow:` values, else `## Gates`
- [ ] the evals' fixture host writes `workflow:`; tests/evals.test.mjs green

## Proof

```sh
node --test tests/workflow-init.test.mjs tests/init.test.mjs tests/roster-init.test.mjs tests/evals.test.mjs
```

passes: the init workflow checks and the existing init, roster-init and evals tests green

## Assumptions

- recommended: under `autonomous` the Gate 2 question is not asked, since every gate already passes by policy, and an existing `gates.spec` is kept as the owner wrote it; under `attended` a no removes a `gates.spec: policy` (source: spec "Init asks, under its Gates question, the global policy, then (under `attended`) whether Gate 2 passes by policy"; "`gates.spec: policy` only when chosen")
- recommended: a re-run reads `## Gates` `spec: only-on-open` as yes to Gate 2, and drops the `## Gates` section from forge.md along with `## Policy skills` (source: spec "A re-run leads with the current `workflow:` values, else the `## Gates` bullets"; "its forge.md template drops `## Gates`")
- recommended: the evals' fixture host writes `version: 1` and `workflow: { policy: attended, max_parallel_slices: 3 }` to forge.yaml (the old `## Gates` had `spec: always`, no override) and keeps its `## Policy skills` bullet, which this slice does not move; the roster-guard fixtures still overwrite forge.yaml with their own roster (source: spec Testing "the frame evals' host fixture writes `workflow:` in forge.yaml instead of `## Gates`")
- recommended: tests/config.test.mjs's "gates.policy attended for a host written from the init template" now asserts no `gates` section, since the template has none (source: spec "its forge.md template drops `## Gates`")

## Comments

merged: clean. Review record: /Users/mosica.bogdan/Desktop/personal/forge-sdlc/.forge/review/workflow-as-code-10.md. Merge sha: d7eb33a495f3903d270855a7bc10cd856d9c3840.
