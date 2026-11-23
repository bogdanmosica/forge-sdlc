# 08: workflow-as-code-04: Mermaid A and the README diagram

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** `bin/workflow.mjs --mermaid [--effort <slug>]` prints the `flowchart TD` from the prototype's look: a box per stage with roles and models (`⇄` when swapped), a hexagon per gate, thin `passes unless …` edges for policy gates, thick edges for attended and owner gates, classes for passed, current and stopped positioned from `.forge/state.json`; the plugin README carries the defaults' diagram, held equal to the command by a test

**Blocked by:** workflow-as-code-03

- [ ] a `gates.plan: attended` host with an effort stopped at plan (`stop: attended`) marks Gate 3 stopped and names `gates.plan in forge.yaml`
- [ ] only `{{ }}`, `==>`, `:::`, `<br/>` and plain edges; no edge label over the prototype's wrap length
- [ ] `--effort` with no state record draws the loop unpositioned
- [ ] the README's Mermaid block equals `--mermaid` on a host with no forge.yaml and no `## Gates`

## Proof

```sh
node --test tests/workflow-mermaid.test.mjs
```

passes: the Mermaid cases and the README equality check green
