# forge-sdlc

A Claude Code plugin, `plugins/forge-sdlc/`, in its own marketplace `forge-personal` (this repository): the AI-native SDLC loop as a team of agents over Matt Pocock's skills. The design is `docs/design.md`; build it in the order of its section 15. The plugin also carries the workbench mod, every Claude session at a glance inside Claude Code: its one hooks module is `plugins/forge-sdlc/hooks/workbench.tsx` (named under `modules` in `hooks/hooks.json`), with `sessions.ts` (the session record, published to `~/.cache/workbench/sessions/<id>.json`), `focus.tsx` (`/focus-pane`), `boards.tsx` (`/boards`), `band.tsx` (the needs-you band above the prompt), `commands.tsx` (`/diff-pane`, `/side-chat`, `/morning`, `/crew`), `jira.ts`, the state contract in `hooks/types/index.d.ts` (named in `plugin.json` as `types`) and the engine's own declarations beside it in `hooks/types/claude-code.d.ts`; tests beside them as `*.test.tsx` over the stand-in host in `workbench.fixture.tsx`, run by `claude plugin test`. A plugin may hook an event only once without a matcher, so `workbench.tsx` holds the four unmatched hooks (session.start, prompt.submit, turn.step, turn.complete) and the parts expose functions for a plugin that already holds them: the same files sit in eMAG's `emag-sdlc` plugin (agent-pipeline, `plugins/emag-sdlc/hooks/`, with `band.tsx` as `needs-you.tsx` beside the run pane's own band), which calls `registerWorkbench`, `startWorkbench`, `noteWorkbenchPrompt`, `noteWorkbenchStep` and `completeWorkbenchTurn` from its run pane's hooks; the two copies differ only in the plugin literal of the state references (`plugin: 'forge-sdlc'`) and that import, so a change is made in one and copied to the other. `plugins/forge-sdlc` is installed at project scope in a host, so a change is tried by starting a session there; bump `plugins/forge-sdlc/.claude-plugin/plugin.json` so `claude plugin list` tells builds apart.

A second plugin, `plugins/workbench/`, lives in the same marketplace and is unrelated to the loop: the command hooks under `hooks/scripts/` that feed the cmux sidebars and the `cmux-crew` skill, installed at user scope (`workbench@forge-personal`) so they run in every session; its mod moved into `forge-sdlc` and `emag-sdlc` on 2026-10-29 (workbench 0.6.0). A change is live in every new session straight from this checkout; bump `plugins/workbench/.claude-plugin/plugin.json` so `claude plugin list` tells builds apart. Its hooks must print nothing and exit 0 outside cmux (`plugins/workbench/tests/hooks.test.mjs`). The cmux side (sidebars, Dock scripts, the status line script) is the `cmux-config` repository, whose CLAUDE.md documents every hook and line.

## Commands

- `npm test`: `test:node`, every test under `tests/` and `plugins/workbench/tests/` (`node --test`), fixture repos in a temp dir, then `test:mod`, `claude plugin test plugins/forge-sdlc` (the workbench mod's `*.test.tsx`). `npm run typecheck`: the mod against the engine's declarations in `plugins/forge-sdlc/hooks/types/claude-code.d.ts` (the engine lays a fresh copy in `plugins/forge-sdlc/.claude-plugin/types/`, gitignored, each time a session loads the plugin; copy it over the committed one when the API moves). Set `MATTPOCOCK_SKILLS_ROOT` to an upstream plugin root so the upstream comparisons run instead of skipping.
- `npm run validate`: the marketplace at the root and both plugins, `--strict`.
- `node plugins/forge-sdlc/bin/skill-path.mjs <skill|--root|--check>`: where an upstream skill file is; `--check` is the UPSTREAM.lock verdict.
- `node plugins/forge-sdlc/bin/forge-config.mjs <host>`: print a host's parsed `docs/agents/forge.md`.
- `node plugins/forge-sdlc/bin/effort-state.mjs [host] <slug>` (or `--list [host]`): an effort's stage, gate and next command, from `.forge/state.json` or re-derived from its artifacts. Read-only.
- `node plugins/forge-sdlc/bin/verify-record.mjs --slice <slug>-<nn> --worktree <dir> --project <host> [--proof "<cmd>"]`: run a slice's proof and the host's proof commands, write `.forge/verify/<slug>-<nn>.json`; exit 0 green, 1 red, 2 bad usage.
- `node plugins/forge-sdlc/bin/crew-name.mjs <role> --project <host> --effort <slug> [--slice <slug>-<nn>]`: print a member's next name from the host's `## Crew` theme in handle form and record it in `.forge/state.json` (`--slice`, an implementer's, reuses the slice's `member`); exit 0, 2 bad usage.
- `claude plugin eval plugins/forge-sdlc ...`: the eval suites; the README's Evals section has the commands. `--max-cost-usd 0` loads every case for free.

## Conventions

- One hook, one script under `plugins/forge-sdlc/hooks/scripts/`, built on `lib.mjs`: payload on stdin, one JSON decision on stdout, exit 0. A thrown error is exit 1 on stderr, never a decision.
- A deny reason names the branch, path or pattern and says what to do instead. It never quotes a matched value.
- Matt's skills are used unmodified and addressed as `mattpocock-skills:<name>`; a user-invoked one is read by file through `bin/skill-path.mjs`. This plugin adds the frame, never a copy of a procedure. `UPSTREAM.lock` names the version tested against and the headings read by file; bump it only after re-reading the delta.
- Hosts configure the plugin in `docs/agents/forge.md` only; the plugin never writes a permission rule into a host's settings.
- Every hook script has a `plugins/forge-sdlc/evals/guardrails/` case whose `seam.json` (payload, expected decision) `tests/evals.test.mjs` runs against the case's fixture; a new hook adds its case, a changed reason updates the case's `hook-*` grader. Every incident adds an eval case.
- The leading words (effort, slice, gate, proof, red, clean, ...) mean what `GLOSSARY.md` says; a decision that changes `docs/design.md` gets a `Decision:` line there and an ADR in `docs/adr/`.

## Agent skills

### Issue tracker

Local markdown: issues live as files under `.scratch/<slug>/` in this repo; the map and tickets sit on the effort branch. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Delivery loop

forge-sdlc runs the loop: wayfinder → intent → spec → plan → build, one folder per effort under `docs/efforts/`, one pushed branch `feat/<slug>`, one PR. Config and proof commands: `docs/agents/forge.md`.
