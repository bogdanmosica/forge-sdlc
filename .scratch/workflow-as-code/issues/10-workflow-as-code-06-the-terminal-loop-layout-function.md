# 10: workflow-as-code-06: The terminal loop layout function

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** A pure layout function in `hooks/forge/help.ts`, `(resolved workflow, columns) → rows of { text, tone }`: from 52 columns passed stages fold to one line with their gate at the right, the current and later stages are boxes with the gate in the bottom border, a stopped gate adds `why:` and `resume: /forge-sdlc:wayfinder <slug>` (only `attended` names its setting's source); below 52 columns one line per stage down to the 24-column floor; legend and glyphs from the prototype

**Blocked by:** workflow-as-code-02

- [ ] rows at 72, 52, 51 and 24 columns
- [ ] a stopped gate's `why:` and `resume:` lines
- [ ] no position draws the loop unpositioned
- [ ] help.ts keeps no imports of its own; the existing help-table tests stay green

## Proof

```sh
node --test tests/workflow-terminal.test.mjs tests/forge-help.test.mjs
```

passes: the layout cases at each width and the help-table tests green
