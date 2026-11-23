# 06: workflow-as-code-02: workflow.yaml and resolveWorkflow

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** The plugin's descriptive loop file `workflow.yaml` (stages `map` … `built` under `effort-state.mjs`'s names, gates `intent`/`spec`/`plan`/`pr`, the stop sets) and the pure `resolveWorkflow(workflowText, roster, { agentModels?, effort? })` in the shared reader: stages in order with roles (agent, model, effort, swapped) and slots, each gate's mode, source, stops and status, the effort's position, `risk: high` forcing attended, and the fixed stage list on a malformed file

**Blocked by:** workflow-as-code-01

- [ ] the shipped file parses with no problems; stage names equal `effort-state.mjs`'s, gate keys equal intent, spec, plan, pr; every role and slot is one the roster knows
- [ ] `flagged` only in Gate 2's stops; Gate 4 mode `owner`
- [ ] roles resolved through a swapped roster
- [ ] passed/current/ahead stages and passed/waiting/stopped/ahead gates for each effort stage and stop
- [ ] `risk: high` shows every gate attended with source `risk: high`
- [ ] a malformed file is a problem and falls back to the fixed stages; the reader stays pure, no imports, never throws

## Proof

```sh
node --test tests/workflow-resolve.test.mjs tests/workflow-file.test.mjs
```

passes: resolveWorkflow cases and the shipped-file checks green
