# YAML without a dependency

Type: research
Status: resolved
Labels: wayfinder:research
Blocked by: none
Map: ../map.md

## Question

The repo has no npm dependencies (`package.json`, Node >= 22) and its hooks and bin scripts run straight from the checkout, and the run pane mod (`hooks/run-pane.tsx`, its pure parts in `hooks/run-pane/*.ts`) runs in the Claude Code plugin engine. Both sides must read `docs/agents/forge.yaml`. What are the options: does Node 22+ or the plugin engine ship any YAML parser; is a vendored single-file parser (which, licence, size) workable in both `.mjs` and the mod; or is a hand-written strict subset (maps, lists, scalars, comments; no anchors, tags, multi-line strings) the safer choice, as `lib.mjs` hand-parses forge.md today and `run-pane/config.ts` mirrors it? Recommend one, with the subset's grammar if a subset, and how one parser is shared between `lib.mjs` and the mod (today a mirror held by `tests/run-pane-config.test.mjs`). Note: `docs/research/roster-as-code/yaml-parsing.md`.

## Answer

Resolved 2026-11-22 by the researcher (Uhura); note `docs/research/roster-as-code/yaml-parsing.md`. Neither Node nor the plugin engine ships a YAML parser (the lead confirmed `require('node:yaml')` is `ERR_UNKNOWN_BUILTIN_MODULE` on Node 24.21). Recommendation: a strict-subset parser, `parseYamlSubset(text) -> { value, errors }`, never throwing, as one pure no-import `.mjs` under `plugins/forge-sdlc/hooks/` that both `lib.mjs` and the mod import, which removes the need for a mirror. Subset: 2-space maps, scalar lists, plain/quoted scalars, booleans, integers, null, comments; anchors, aliases, tags, merge keys, block scalars, multi-line flow, multi-document and duplicate keys rejected with a located error. Open hypotheses for the build to prove with a spike: the mod bundler resolves `./yaml-subset.mjs` from a `.ts` file; the schema needs no list-of-maps (settled by The forge.yaml schema).
