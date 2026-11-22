# YAML without a dependency

Type: research
Status: open
Labels: wayfinder:research
Blocked by: none
Map: ../map.md

## Question

The repo has no npm dependencies (`package.json`, Node >= 22) and its hooks and bin scripts run straight from the checkout, and the run pane mod (`hooks/run-pane.tsx`, its pure parts in `hooks/run-pane/*.ts`) runs in the Claude Code plugin engine. Both sides must read `docs/agents/forge.yaml`. What are the options: does Node 22+ or the plugin engine ship any YAML parser; is a vendored single-file parser (which, licence, size) workable in both `.mjs` and the mod; or is a hand-written strict subset (maps, lists, scalars, comments; no anchors, tags, multi-line strings) the safer choice, as `lib.mjs` hand-parses forge.md today and `run-pane/config.ts` mirrors it? Recommend one, with the subset's grammar if a subset, and how one parser is shared between `lib.mjs` and the mod (today a mirror held by `tests/run-pane-config.test.mjs`). Note: `docs/research/roster-as-code/yaml-parsing.md`.
