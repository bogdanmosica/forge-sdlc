# 09: workflow-as-code-05: The attended stop in effort-state and the state contract

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** `effort-state.mjs` keeps its keys and adds `gates` (`{ intent, spec, plan, pr }`, each `{ mode, source }` from `readWorkflow`); `STOP_WHY.attended` reads `gate <gate> is attended in forge.yaml (<key>)`, or `gate <gate> was attended in forge.yaml` when the settings no longer make it so; the state contract and `docs/contracts.md` gain `stop: 'attended'`, last in the closed set

**Blocked by:** workflow-as-code-03

- [ ] `stop: attended` gives the why naming `gates.plan` or `workflow.policy`
- [ ] the was-attended why when settings changed
- [ ] `gates` reports each mode and source
- [ ] a host with `## Gates` and no forge.yaml prints what it printed before apart from `gates`
- [ ] `hooks/types/index.d.ts` typechecks with `attended`

## Proof

```sh
node --test tests/effort-state-workflow.test.mjs tests/effort-state.test.mjs && npm run typecheck
```

passes: the new effort-state cases and the existing ones green, the mod typechecks
