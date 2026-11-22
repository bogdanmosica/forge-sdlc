---
effort: workflow-as-code
stage: map
status: draft
risk: normal
updated: 2026-11-22
---

# Workflow as code: the forge-sdlc loop declared in forge.yaml and drawn as a diagram

## Destination

### Problem

The loop (wayfinder → intent → spec → plan → build, Gates 1 to 4, who passes each, the four stops) exists only as prose spread over `skills/*/SKILL.md`, `skills/wayfinder/GATE-POLICY.md`, ADR 0018 and the `/forge` panel's `LOOP` table in `hooks/forge/help.ts`; its knobs sit in forge.md `## Gates` (`policy`, `spec`, `max_parallel_slices`). An owner cannot see the whole workflow at once, which gates will pass by themselves under `autonomous` and why one stops, or tune autonomy per gate. Warp's "factories as code" talk (https://www.youtube.com/watch?v=0LeT996Hz3E) puts the factory's blueprint, its workflow, in the same declarative file as its agents. The roster (effort `roster-as-code`) is that file's first layer and reserves a `workflow:` key; this effort fills it.

### Outcome

`docs/agents/forge.yaml` gains a `workflow:` section that **describes** the loop as it is (stages, their order, the gates between them, who passes each, the stop rules) and holds its existing knobs: the gate policy, the spec gate, `max_parallel_slices`, and a per-gate override (e.g. Gate 3 always attended). The plugin reads the knobs from there; forge.md `## Gates` is deprecated as `## Routing` is by the roster. The declared workflow is drawn from the same file in two places: `bin/workflow.mjs --mermaid` prints a Mermaid diagram (GitHub draws it in the README and each effort's PR body), with the roster's agent and model per stage on its nodes; and the `/forge` panel's loop view shows the same picture in the terminal, highlighting where the current effort stands and the gate it waits at.

Observable: on this repo, `node bin/workflow.mjs --mermaid` prints a diagram GitHub renders; setting Gate 3 to attended in `forge.yaml` makes the next autonomous run stop at the plan quiz and the diagram and `/forge` both show Gate 3 as owner-passed; without a `workflow:` section everything reads as today.

### Users

The owner of a host who wants to see and tune the loop's autonomy. A reviewer reading an effort's PR, who sees where it stands. The prior-sdlc port, which takes the same schema later.

### Constraints

- Descriptive only: stages cannot be reordered, added or removed; the upstream procedures and the frame's headings stay pinned.
- Charting, grilling tickets and Gate 4 stay human under every setting (Matt's wayfinder; ADR 0018).
- Builds on the roster: same file, same parser, same problem reporting; this effort's plan and build start after `roster-as-code` merges.
- Diagram and terminal view are generated from the file, never hand-kept, so they cannot drift.
- No `workflow:` section is exactly today's behaviour.
- Public repo: no private names or paths.

### Open questions

- The `workflow:` schema and which knobs move (ticket: The workflow schema).
- What per-gate autonomy may override, and what it may not (ticket: Per-gate autonomy).
- What the terminal can draw in the `/forge` panel (ticket: Drawing the loop in the terminal).
- How the diagram should look (ticket: The diagram).

## Notes

Engineering, in this plugin. Sessions read `docs/efforts/roster-as-code/intent.md` (and its spec once committed), `skills/wayfinder/GATE-POLICY.md`, ADR 0018, `hooks/forge/help.ts` and `hooks/forge.tsx`, `GLOSSARY.md`. Skills to consult: `mattpocock-skills:writing-for-agents` for every skill edit. Standing preference: the workflow is described, not programmable; what a human must decide stays the human's.

## Decisions so far

- Destination settled by grilling on 2026-11-22, four questions, every recommendation accepted:
  - A separate effort from `roster-as-code`, building on its schema through the reserved `workflow:` key.
  - Descriptive workflow plus the existing knobs (policy, spec gate, max parallel slices) and a per-gate override; not prescriptive.
  - Diagram as Mermaid from `bin/workflow.mjs` for GitHub, and the live terminal view in `/forge`; an artifact page later.
  - "Autonomous" means declaring and tuning the gate policy and its stops; charting, grilling and Gate 4 stay human.

## Not yet specified

- How the PR body carries the diagram: written once at intent, or refreshed by each stage with the effort's position marked.
- The eval cases and the deprecation path's tests for `## Gates`.
- Whether `effort-state.mjs` and `/forge-sdlc:status` print through the declared workflow.

## Out of scope

- A prescriptive workflow: reordering, adding or removing stages, swapping upstream procedures.
- Automating charting, grilling, or Gate 4.
- Triggers (issue labels, schedules) and measurement layers.
- An interactive artifact page of the diagram (later).
