# 11: workflow-as-code-07: The /forge loop tab draws the loop

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** The `/forge` panel reads `workflow.yaml` from the plugin root through the shared reader and the newest effort's record in `.forge/state.json`, and its loop tab renders the layout function's rows, the `LOOP` prose kept under the diagram; `GATES` names forge.yaml's `workflow:` and the per-gate override; `workflow:` problems show in the band and toasts where roster problems do; the panel's types gain the resolved workflow

**Blocked by:** workflow-as-code-05, workflow-as-code-06

- [ ] the loop tab over the stand-in host shows the current stage and a stopped gate's `why:` and `resume:`
- [ ] the prose rows under the diagram
- [ ] one line per stage below 52 columns
- [ ] no effort: the loop unpositioned
- [ ] a bad `workflow:` key appears in the band like a roster problem
- [ ] the mod typechecks

## Proof

```sh
test -f plugins/forge-sdlc/hooks/forge.workflow.test.tsx && claude plugin test plugins/forge-sdlc && npm run typecheck
```

passes: the loop tab tests and every existing mod test green, the mod typechecks
