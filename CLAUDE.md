# forge-sdlc

A Claude Code plugin, `plugins/forge-sdlc/`, in its own marketplace `forge-personal` (this repository): the AI-native SDLC loop as a team of agents over Matt Pocock's skills. The design is `docs/design.md`; build it in the order of its section 15.

## Commands

- `npm test`: every test under `tests/` (`node --test`), fixture repos in a temp dir. Set `MATTPOCOCK_SKILLS_ROOT` to an upstream plugin root so the upstream comparisons run instead of skipping.
- `npm run validate`: the marketplace at the root and the plugin, `--strict`.
- `node plugins/forge-sdlc/bin/skill-path.mjs <skill|--root|--check>`: where an upstream skill file is; `--check` is the UPSTREAM.lock verdict.
- `node plugins/forge-sdlc/bin/forge-config.mjs <host>`: print a host's parsed `docs/agents/forge.md`.
- `node plugins/forge-sdlc/bin/effort-state.mjs [host] <slug>` (or `--list [host]`): an effort's stage, gate and next command, from `.forge/state.json` or re-derived from its artifacts. Read-only.
- `node plugins/forge-sdlc/bin/verify-record.mjs --slice <slug>-<nn> --worktree <dir> --project <host> [--proof "<cmd>"]`: run a slice's proof and the host's proof commands, write `.forge/verify/<slug>-<nn>.json`; exit 0 green, 1 red, 2 bad usage.
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
