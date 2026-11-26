# 26. The loop declared in workflow.yaml, tuned per gate in forge.yaml

Status: accepted, 2026-11-24; supersedes ADR 0018 in part (its single global policy under `## Gates` in forge.md), and moves the removal ADR 0025 promised for 0.9.0 to the next minor

## Context

The loop's shape (map, intent, spec, plan, build; Gates 1 to 4; who passes each gate; what stops a run) was written only as prose: in each stage's skill, in `skills/wayfinder/GATE-POLICY.md`, in ADR 0018 and in the `/forge` panel's loop table. Its knobs sat in forge.md `## Gates` (`policy`, `spec`, `max_parallel_slices`). An owner could not see the loop whole, could not tell which gates pass by themselves under `autonomous` or why a run stopped where it did, and could tune autonomy only globally: the one per-gate knob, Gate 2's `spec: only-on-open`, worked only under `attended`. A reviewer of an effort's PR could not see where the effort stood. The roster (ADR 0025) had reserved a `workflow:` key in `docs/agents/forge.yaml` for this.

## Decision

- The plugin describes its own loop in one file, `plugins/forge-sdlc/workflow.yaml`, in the forge.yaml YAML subset: the stages in `effort-state.mjs`'s order and names (`map`, `intent`, `spec`, `plan`, `build`, `built`), what each does, its roles and slots, and the gate it ends at (`intent`, `spec`, `plan`, `pr`) with that gate's own stop list. The file is descriptive: a host cannot reorder, add or remove a stage, and a test holds the file to the fixed names.
- A host tunes the loop under `workflow:` in `docs/agents/forge.yaml` and nowhere else: `policy` (`attended` | `autonomous`), `max_parallel_slices` and `gates.<key>` for `intent`, `spec` and `plan`, each `attended` or `policy`, overriding the global policy for that gate alone. Every key is optional; `gates.pr`, any other key and any bad value are reported problems and ignored. Gate 4 stays the code owner's.
- A gate's mode resolves first match wins, its source travelling with it: `gates.<key>` in forge.yaml; then, for Gate 2 only and only when forge.yaml sets neither `workflow.policy` nor `gates.spec`, forge.md's `spec: only-on-open` as `policy`; then `workflow.policy`, then forge.md's `## Gates` `policy`, then `attended`. The stop rules (`open`, `flagged`, `risk-high`) stay fixed, and `risk: high` still stops every gate.
- A new stop reason, `attended`, last in the closed set: written when a gate stops because its mode is `attended` from forge.yaml (`gates.<key>` or `workflow.policy`). An attended stop from `## Gates` or the default writes no `stop`, as before. Any gate passed by policy continues in the same run, and its report line names the setting that passed it.
- One pure reader resolves it: `hooks/roster.mjs` gains `roster.workflow` and `resolveWorkflow`, `lib.mjs` gains `readWorkflow`, and `bin/workflow.mjs` prints the resolved workflow as JSON, one gate's mode, source and stops (`--gate <key>`), or a Mermaid flowchart (`--mermaid [--effort <slug>]`). The stages read their gate and the build its `max_parallel_slices` from it; the README's diagram, each effort PR's `## Workflow` section and the `/forge` panel's loop tab are drawn from it, never kept by hand.
- forge.md's `## Gates` is deprecated: each bullet left there is a band line naming the forge.yaml key to move it to, and `/forge-sdlc:init` writes `workflow:` to forge.yaml instead of `## Gates`.
- The deprecation window moves: 0.9.0 still reads `## Routing`, `## Policy skills` and `## Gates`, and all three are removed together in the next minor, 0.10.0, not in 0.9.0 as ADR 0025 and `hooks/ROUTING.md` said.

## Consequences

- An owner sees the whole loop in one picture, in the README, in each effort's PR body and in `/forge`, and the picture cannot drift from the code: tests hold the README's block equal to `bin/workflow.mjs --mermaid` and `workflow.yaml` to the stage and gate names.
- Autonomy is set one gate at a time: `gates.plan: attended` keeps the plan quiz for the owner while Gates 1 and 2 pass by policy, and `gates.spec: policy` replaces `spec: only-on-open`. `spec: always` has no equivalent, since Gate 2 already follows `workflow.policy`.
- `effort-state.mjs` gains a `gates` field and explains an `attended` stop (`gate plan is attended in forge.yaml (gates.plan)`), so `/forge-sdlc:status` says which setting to change.
- A host with no `workflow:` reads and runs exactly as before, apart from one deprecation line per `## Gates` bullet.
- A host on 0.9.0 has one more minor to move `## Routing`, `## Policy skills` and `## Gates` to forge.yaml; the band names each move.
- The rule a gate follows is still written once, in `GATE-POLICY.md`; ADR 0018's stop rule, report prefix and state write stand, only its single global policy and its home in forge.md are superseded.
