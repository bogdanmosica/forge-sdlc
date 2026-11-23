# 08: workflow-as-code-04: Mermaid A and the README diagram

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** `bin/workflow.mjs --mermaid [--effort <slug>]` prints the `flowchart TD` from the prototype's look: a box per stage with roles and models (`⇄` when swapped), a hexagon per gate, thin `passes unless …` edges for policy gates, thick edges for attended and owner gates, classes for passed, current and stopped positioned from `.forge/state.json`; the plugin README carries the defaults' diagram, held equal to the command by a test

**Blocked by:** workflow-as-code-03

- [x] a `gates.plan: attended` host with an effort stopped at plan (`stop: attended`) marks Gate 3 stopped and names `gates.plan in forge.yaml`
- [x] only `{{ }}`, `==>`, `:::`, `<br/>` and plain edges; no edge label over the prototype's wrap length
- [x] `--effort` with no state record draws the loop unpositioned
- [x] the README's Mermaid block equals `--mermaid` on a host with no forge.yaml and no `## Gates`

## Proof

```sh
node --test tests/workflow-mermaid.test.mjs
```

passes: the Mermaid cases and the README equality check green

## Assumptions

- recommended: "the plugin README" is the repository's root `README.md` (the plugin's page, titled forge-sdlc), its block under `## The loop`, since `plugins/forge-sdlc/` has no README of its own (source: ticket, "the plugin README carries the defaults' diagram")
- recommended: the prototype's wrap length is 40 characters, its longest edge label (`passes unless open · flagged · risk-high`) at its `wrappingWidth: 320`; so an attended edge reads `you pass it` and the gate's source sits on its hexagon, `Gate 3 · attended · gates.plan in forge.yaml`, keeping `workflow.policy in forge.yaml` (43 with its prefix) off the edges (source: spec Mermaid A, "An attended gate's label names its source, as in `attended · gates.plan in forge.yaml`")
- recommended: a policy gate's edge lists its stops without `attended`, which never stops a policy gate (source: spec Mermaid A, `passes unless <stops joined by ' · '>`; the prototype's `mermaidA`)
- recommended: labels carry `<br/>` as their only markup, the prototype's `<b>` and `<i>` dropped, and the stage boxes name the model short (`claude-opus-5-5` as `opus`) as the prototype does (source: ticket, "only `{{ }}`, `==>`, `:::`, `<br/>` and plain edges")
- recommended: `--effort` naming no record prints the same bytes as no `--effort`; `--effort` without `--mermaid`, an empty `--effort` and `--mermaid` with `--gate` are bad usage, exit 2 (source: spec, `workflow.mjs --mermaid [--effort <slug>]`)
- recommended: the renderer is `mermaidOf(workflow)`, exported from `bin/workflow.mjs` beside the only command that prints it, over `readWorkflow`'s result (source: spec, `bin/workflow.mjs` "prints Mermaid A")
