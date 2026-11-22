---
effort: workflow-as-code
stage: intent
status: draft
risk: high
updated: 2026-11-22
---

# Intent: Workflow as code: the forge-sdlc loop declared in forge.yaml and drawn as a diagram

Map: [map.md](map.md)

## Problem

The loop (map → intent → spec → plan → build, Gates 1 to 4, who passes each, the stops) exists only as prose spread over `skills/*/SKILL.md`, `skills/wayfinder/GATE-POLICY.md`, ADR 0018 and the `/forge` panel's `LOOP` table, and its knobs sit in forge.md `## Gates` (`policy`, `spec`, `max_parallel_slices`). An owner cannot see the whole workflow at once, cannot tell which gates will pass by themselves under `autonomous` and why one stops, and cannot tune autonomy per gate: the only per-gate knob is Gate 2's `spec: only-on-open`. Warp's "factories as code" talk (https://www.youtube.com/watch?v=0LeT996Hz3E) puts the factory's blueprint, its workflow, in the same declarative file as its agents. The roster (effort `roster-as-code`) is that file's first layer and reserves room for a `workflow:` key; this effort fills it.

## Outcome

- **The plugin describes its loop** in `plugins/forge-sdlc/workflow.yaml`: stages in order with `effort-state.mjs`'s names (`map`, `intent`, `spec`, `plan`, `build`, `built`), what each does, its roles and slots, and the gate it ends at (`intent`, `spec`, `plan`, `pr`), each gate with its own stop list (`flagged` only at Gate 2). It is the single source for the diagram, the `/forge` panel and the tests.
- **The host holds only knobs** in `docs/agents/forge.yaml`:

  ```yaml
  workflow:
    policy: autonomous
    max_parallel_slices: 3
    gates:
      intent: policy     # Gate 1
      spec: policy       # Gate 2
      plan: attended     # Gate 3
  ```

  A gate is `attended` or `policy`, overriding the global `policy` for that gate alone; `gates.pr` is a reported error. `spec: only-on-open` becomes `gates.spec: policy`. The stop rules (`open`, `flagged`, `risk-high`) are fixed and `risk: high` forces every gate attended. A new stop reason `attended` (last in the closed set) names a gate set attended, and `effort-state` says `why: gate <stage> is attended in forge.yaml`. Any gate passed by policy continues in the same run. forge.md `## Gates` is read with a deprecation toast for one minor version; init writes `forge.yaml` instead.
- **Drawn from the file in two places**: `bin/workflow.mjs --mermaid` prints Mermaid A (one top-down chain; gate hexagons by who passes them; stops on the edges; roster agent and model per stage; passed, current and stopped classes), which GitHub draws in the README and each effort's PR body; the `/forge` panel shows terminal B (passed stages folded to a line, the gate on its stage's box border, `why:` and `resume:` under a stopped gate, one line per stage below 52 columns). A stopped gate's `why:` comes from the effort's stop reason; only `attended` names where the setting came from.

Observable: on this repo, `node plugins/forge-sdlc/bin/workflow.mjs --mermaid` prints a diagram GitHub renders; setting `gates.plan: attended` makes the next autonomous run stop at the plan quiz with `stop: attended`, and the diagram and `/forge` both show Gate 3 as attended by `gates.plan in forge.yaml`; without a `workflow:` section everything reads as today.

## Users

The owner of a host who wants to see and tune the loop's autonomy. A reviewer reading an effort's PR, who sees where it stands. The stages (wayfinder, spec, plan, build, status), which read their gate from the declared workflow. The prior-sdlc port, which takes the same schema later.

## Constraints

- Descriptive only: stages cannot be reordered, added or removed; upstream procedures and the frame's headings stay pinned.
- Charting, grilling tickets and Gate 4 stay human under every setting (Matt's wayfinder; ADR 0018).
- Builds on `roster-as-code`: same file, same shared parser and resolver, same problem reporting. This effort's plan and build start after `roster-as-code` merges.
- Diagram and panel are generated from the files, never hand-kept.
- No `workflow:` section is exactly today's behaviour; `## Gates` keeps working through its deprecation.
- Touches `plugins/forge-sdlc/hooks/**` (the `/forge` panel, the shared reader) and `.claude-plugin/**` (version): `risk: high`, attended.
- Public repo: no private names or paths.

## Open questions

none

## Decisions so far

- Destination, grilled 2026-11-22: a separate effort building on the roster; descriptive workflow plus the existing knobs and a per-gate override; Mermaid for GitHub and a live `/forge` view, an artifact page later; "autonomous" means declaring and tuning the gate policy and its stops, never automating charting, grilling or Gate 4.
- [Drawing the loop in the terminal](../../../.scratch/workflow-as-code/issues/01-drawing-the-loop-in-the-terminal.md): no graph renderer in the engine; `/forge` draws the loop vertically from `Box`/`Text` with a narrow fallback; GitHub renders Mermaid in PR bodies and README.
- [The workflow schema](../../../.scratch/workflow-as-code/issues/02-the-workflow-schema.md): the plugin ships `workflow.yaml`; the host's `workflow:` holds only knobs; `## Gates` deprecated; init writes `forge.yaml`; nodes show the roster's resolved agent and model.
- [Per-gate autonomy](../../../.scratch/workflow-as-code/issues/03-per-gate-autonomy.md): `attended` or `policy` per gate over the global policy; only-on-open becomes `gates.spec: policy`; stop rules fixed, risk high forces attended; new stop reason `attended`; a policy-passed gate continues in the run.
- [The diagram](../../../.scratch/workflow-as-code/issues/04-the-diagram.md): Mermaid A and terminal B; `why:` from the stop reason; per-gate stop lists; `effort-state.mjs` stage names.

## Out of scope

- A prescriptive workflow: reordering, adding or removing stages, swapping upstream procedures.
- Automating charting, grilling or Gate 4.
- Triggers (issue labels, schedules) and measurement layers.
- An interactive artifact page of the diagram (later).
- The prior-sdlc side (its own port).

## Assumptions to confirm

- recommended: the build waits for `roster-as-code` to merge to `main`; this effort's branch is rebased onto it before the plan stage, since it extends the shared reader and `forge.yaml` (source: Destination)
- recommended: the PR body's `## Workflow` section carries the Mermaid diagram, written at intent and refreshed by each stage's gate record with the effort's position marked (source: none)
- recommended: `effort-state.mjs`, `/forge-sdlc:status` and GATE-POLICY.md read gate modes and stop lists from the resolved workflow (plugin `workflow.yaml` plus host knobs), so the prose rule and the diagram cannot disagree; GATE-POLICY.md's stop-reasons table gains `plan.md` for `open` (source: The diagram)
- recommended: `## Gates` and its `spec` key are removed in the minor version after this one ships; the toast names `forge.yaml` and the key to move, `spec: only-on-open` as `gates.spec: policy` (source: Per-gate autonomy)
- recommended: the `/forge` panel's `LOOP` table text stays as prose under the diagram for what the driver does at each stage; only its structure comes from `workflow.yaml` (source: none)
- recommended: Mermaid uses only long-standing syntax (`{{ }}`, `==>`, `:::class`, `<br/>`) and short edge labels; GitHub's Mermaid version is checked by hand at Gate 4 on the PR body itself (source: The diagram)
- recommended: an ADR records the descriptive workflow file and the per-gate override, superseding ADR 0018's single global policy in part (source: CLAUDE.md Conventions)
- recommended: `plugins/forge-sdlc` bumps a minor after roster's 0.8.0 (source: CLAUDE.md)
