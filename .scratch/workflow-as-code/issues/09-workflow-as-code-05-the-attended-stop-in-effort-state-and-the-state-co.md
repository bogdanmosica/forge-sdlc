# 09: workflow-as-code-05: The attended stop in effort-state and the state contract

Type: slice
Status: resolved
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

## Assumptions

- recommended: `gates` is positioned on the effort (`readWorkflow(host, slug)`), so a `risk: high` effort reads every gate `attended` with source `risk: high`; the attended `why` reads the unpositioned settings, so it always names the forge.yaml key (source: spec, "For a `risk: high` effort the diagram shows every gate as attended with source `risk: high`"; "status and the panel read one answer")
- recommended: `policy` becomes the resolved global policy, `workflow.policy` in forge.yaml before `## Gates` `policy`; on a host without forge.yaml it reads as before (source: spec, "`policy` stays the resolved global policy"; user story 6)
- recommended: `hooks/types/index.d.ts` had no stop type, so it gains `ForgeStop = 'open' | 'flagged' | 'risk-high' | 'attended'`, held to `docs/contracts.md` by `tests/effort-state-workflow.test.mjs` (source: spec, "The state contract (`hooks/types/index.d.ts`) gains `stop: 'attended'`")
- recommended: the contracts' stop bullet keeps `open` naming intent.md or spec.md; `plan.md` for `open` is slice 08's, with `tests/plan.test.mjs` in its proof (source: plan row 08; spec, "The stop-reasons table gains `plan.md` for `open`" under the gate policy reference)
- recommended: an `attended` stop on a gate with no forge.yaml setting (`none`, `pr`, or settings since changed) reads `gate <gate> was attended in forge.yaml` (source: spec, `effort-state.mjs` paragraph)

## Comments

- merged: review record .forge/review/workflow-as-code-05.md, merge sha 9e0a416
