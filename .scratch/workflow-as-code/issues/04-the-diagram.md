# The diagram

Type: prototype
Status: resolved
Labels: wayfinder:prototype
Blocked by: 01, 02, 03
Map: ../map.md

## Question

What should the loop diagram look like, in Mermaid and in the terminal: a rough Mermaid flowchart generated from a sample `forge.yaml` (stages, gates marked by who passes them, stops as edges, roster agent and model per stage) and a text mock of the `/forge` panel view with a current stage and a stopped gate highlighted, for the owner to react to before the schema of what the diagram reads is final.

## Answer

Resolved 2026-11-22: prototype by the prototyper (Geordi-La-Forge), owner reacted and accepted. Asset: `docs/research/workflow-as-code/diagram-prototype/` (throwaway `run.mjs` with its sample `workflow.yaml` and `forge.yaml`, and `mermaid-a.png`; `run.mjs` reads `agents/*.md` relative to its original place under `plugins/forge-sdlc/`, so it runs only when copied back there).

- **Mermaid A** for GitHub: one top-down chain, stage box → gate hexagon → next stage. A stage box shows name, what it does, one line per role with model (`reviewer ⇄ my-plugin:reviewer · sonnet` when swapped). A gate shows who passes it (`policy`, `attended`, `code owner`); its stops ride the edge it passes by (`passes unless open · flagged · risk-high`); thin arrow = policy passes, thick = a person. Classes mark passed, current (`▶`) and stopped (`■ … STOPPED: <reason>`). Keep edge labels short (long ones wrap mid-word).
- **Terminal B** for `/forge`: passed stages folded to one line with their gate at the right; the current stage and those ahead as boxes with the gate written into the bottom border; a stopped gate adds `why:` and `resume:` lines; 20 rows at 72 columns; one line per stage below 52 columns, down to the 24 floor.
- Folded into the schema (owner):
  1. A stopped gate's `why:` comes from its **stop reason**, not its mode; only `attended` names where the setting came from (`gates.plan in forge.yaml`, `policy attended`, `risk: high`). The diagram reads both the gate's mode with its source and the effort's stop reason.
  2. The plugin's `workflow.yaml` gives **each gate its own stop list** (`flagged` only at Gate 2; `attended` shown only when it is the gate's mode).
  3. **Stage names are `effort-state.mjs`'s**: `map`, `intent`, `spec`, `plan`, `build`, `built`; gates keyed `intent`, `spec`, `plan`, `pr`.
- Side finding for the spec: GATE-POLICY.md's stop rule requires no `open:` line in `plan.md` at Gate 3, while its stop-reasons table names only `intent.md` and `spec.md` for `open`; the table gets `plan.md`.
