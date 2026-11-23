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

## Assumptions

- recommended: the function is `loopRows(workflow, columns)`, exported from `hooks/forge/help.ts` with `LOOP_BOXES` (52), `LOOP_FLOOR` (24) and `LOOP_LEGEND`; it declares the resolved workflow's shape itself (`LoopWorkflow`), structurally the reader's `ResolvedWorkflow`, so help.ts keeps no imports, not even a type-only one (source: ticket "help.ts keeps no imports of its own")
- recommended: every row is exactly the panel's width (padded, or cut with `…`), and a width under 24 lays out at 24; tones are the closed set `title`, `legend`, `plain`, `passed`, `current`, `ahead`, `stopped`, `swapped`, `note` for slice 07 to paint (source: spec "rows of { text, tone }"; the prototype's `pad` and colours)
- recommended: a gate's border text is cut to fit (`○ Gate 2 · policy · stops on open · flagged ·…` at 52), and the legend wraps at whole entries rather than being cut (source: notes/prototype.md "The implementer must truncate it; the prototype does not")
- recommended: a policy gate's `stops on` leaves out `attended`, which only an attended gate stops on (source: spec Mermaid A "passes unless open · flagged · risk-high")
- recommended: `why:` reads `an open: line in <artifact>`, `a flagged concern in <artifact>`, `risk: high, every gate attended`, or `attended by <source>` (e.g. `gates.plan in forge.yaml`), the prototype's `stopWhy`; the narrow view writes the same `why:` and `resume:` lines, cut to width (source: spec user story 29; prototype `stopWhy`)
- recommended: the record's waiting gate is `▶ Gate <n> · <mode> · waiting`, and a passed stage folds only when its gate passed too, so `built`/`pr` keeps build a box waiting at Gate 4 (source: spec "passed stages fold to one line each with their gate at the right"; slice 02's position reading)
- recommended: with no effort the title is `the loop · policy <p> · ≤<n> slices`, every gate is `○` (ahead of any effort), nothing is folded and no row but the legend shows `▶`, `✓` or `■` (source: spec "or the loop with no position when there is none")
- recommended: a stage with no roles shows `lead` and its command, since the resolved stage carries no `lead` text; the agent column takes the model column's room when no role of the stage has a model (source: prototype `compact`; slice 02's resolved stage shape)
