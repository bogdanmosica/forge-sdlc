# 14: workflow-as-code-10: Init writes workflow: to forge.yaml

Type: slice
Status: open
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
