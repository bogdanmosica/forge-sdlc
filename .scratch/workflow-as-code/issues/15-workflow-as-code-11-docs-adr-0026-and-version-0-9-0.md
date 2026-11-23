# 15: workflow-as-code-11: Docs, ADR 0026 and version 0.9.0

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** ADR 0026 (the descriptive workflow file, the per-gate override, the `attended` stop, superseding ADR 0018 in part, and the deprecation window moved: `## Routing`, `## Policy skills` and `## Gates` removed together in the next minor), a `Decision:` line in `docs/design.md`, `hooks/ROUTING.md` listing `## Gates` as deprecated with the restated removal, the README's `workflow:` schema, GLOSSARY's gate policy and host config entries, CLAUDE.md's Commands line for `bin/workflow.mjs` and the loop-tab clause, this repository's `## Gates` moved to `workflow:` in a new `docs/agents/forge.yaml`, and `plugins/forge-sdlc` at 0.9.0

**Blocked by:** workflow-as-code-07, workflow-as-code-09, workflow-as-code-10

- [ ] ADR 0026 and the design Decision line
- [ ] ROUTING.md and ADR 0025's removal promise restated to the next minor
- [ ] README schema; GLOSSARY entries; CLAUDE.md lines
- [ ] this repo's forge.yaml holds `workflow:` and forge.md has no `## Gates`
- [ ] plugin.json 0.9.0 (roster-docs' version check moved with it)
- [ ] validate, typecheck and every test green

## Proof

```sh
node --test tests/workflow-docs.test.mjs && npm run check
```

exits 0: the docs checks, validate, typecheck and every test green
