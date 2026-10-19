---
name: init
description: Set up a host for the forge-sdlc loop once, after Matt's setup-matt-pocock-skills, by deriving the proof commands and branches from the repo and asking only what it cannot know, then writing docs/agents/forge.md and the Delivery loop block in CLAUDE.md.
disable-model-invocation: true
---

Setup writes one file, `docs/agents/forge.md`, the **host config** every forge-sdlc skill and hook reads, and one sub-block in CLAUDE.md that points at it. Ask only what the host cannot know about itself; everything else is a **derived value** read from the repo and confirmed in passing.

## 1. Precondition

`docs/agents/issue-tracker.md` must exist: Matt's setup owns the tracker, the triage labels and the domain-docs layout, and this skill never asks those again. When it is missing, stop with one line: run `/mattpocock-skills:setup-matt-pocock-skills` first, then `/forge-sdlc:init`.

When `docs/agents/forge.md` already exists, this is a re-run: read it, and every question below leads with the current value.

## 2. Derive

Read, never assume: `package.json` scripts, `Makefile`, `pyproject.toml`, `Cargo.toml`, `go.mod`; the formatter config (`.prettierrc`, `biome.json`, `ruff`, `rustfmt`); `git symbolic-ref refs/remotes/origin/HEAD` for the default branch; the CI config for the commands it runs; the test file layout. From these, draft every value in [FORGE-TEMPLATE.md](FORGE-TEMPLATE.md). A value with one obvious source is derived; a value with none is asked.

## 3. Ask

One section per AskUserQuestion call, derived value first, `(Recommended)` on it. Skip a section whose every value was derived with one source.

1. **Proof commands**: test, typecheck, lint, and build when the host has one. These are what the verifier runs and the Stop hook reads, so each must exit non-zero on failure.
2. **Formatter**: the command run on a file after every edit, or `none`.
3. **Branches**: the default branch, and any other protected globs (`release/*`). The effort and slice shapes are fixed, `feat/<slug>` and `slice/<slug>-<nn>`, and are not asked.
   **Worktrees**: the dependency directory to symlink into each slice worktree (`node_modules`, `.venv`, `vendor`, or none). Derived from what exists at the root; asked only when none or several exist.
4. **Gates**: `spec` is `always` (the owner approves every spec) or `only-on-open` (a spec with no `open:` assumption flows into plan). Lead with `always`. `max_parallel_slices`, lead with 3.
5. **Risk globs**: paths that make an effort `risk: high` (auth, payments, migrations, infra), or none.
6. **Policy skills**: skills the spec-writer and reviewer apply by name (`security-review`, a host skill), or none.
7. **Crew**: the crew theme that names every agent the loop starts, display only. Derived from nothing, so always asked; a re-run leads with the current theme. Header `Crew`, question `Crew theme: which theme names the agents while they run?`, options `None` (agents are named after their role, an implementer after its slice; maps to `none`), `A preset`, `My own theme`.
   `A preset` asks again through the same dialog, header `Crew`, question `Crew preset: which preset names the agents?`, one page per call: `Warcraft`, `Star Trek`, `Star Wars`, `More presets`; after `More presets`, `Game of Thrones`, `Super Mario`. Ids, the presets of the plugin's `crew.json`: `Warcraft` to `warcraft`, `Star Trek` to `star-trek`, `Star Wars` to `star-wars`, `Game of Thrones` to `got`, `Super Mario` to `mario`.
   Free text at any Crew step is a theme. Free text that names a preset, in any case (`mario`, `Star trek`), maps to its id. Any other free text is the theme as typed, and init writes a `names.<role>` bullet for each of the eight roles, `researcher`, `prototyper`, `spec-writer`, `implementer`, `verifier`, `reviewer`, `merger` and `general`, with characters of that theme in display form, each name once: at least five for `implementer` and three for every other role. `My own theme` with nothing typed asks again. A dismissed Crew question or preset page keeps the current theme, `none` on a fresh host.

## 4. Write

- `docs/agents/forge.md` from the template, every section present, every bullet one `- key: value` line, a trailing `# comment` only where the template has one. Re-run: rewrite the file whole from the answers; the one thing a human adds by hand, a `names.<role>` bullet under `## Crew`, is kept while the theme stays and replaced when the theme changes.
- The `### Delivery loop` sub-block under `## Agent skills` in whichever of CLAUDE.md or AGENTS.md Matt's setup edited, replaced in place when present:

  ```markdown
  ### Delivery loop

  forge-sdlc runs the loop: wayfinder → intent → spec → plan → build, one folder per effort under `docs/efforts/`, one pushed branch `feat/<slug>`, one PR. Config and proof commands: `docs/agents/forge.md`.
  ```

- `.forge/` appended to `.gitignore` when absent: the run state, worktrees and verify records live there.

Then check the file reads back: `node "${CLAUDE_PLUGIN_ROOT}/bin/forge-config.mjs"` prints the config with `rules.effort` equal to `feat/*`; a non-zero exit means the file is malformed, fix it before reporting.

## 5. Report

Three lines: the config path, the proof commands as written, and the guardrails now in force on this host (edits and commits on a protected branch are refused; only `feat/<slug>` is pushed). Done when the config reads back and both files are written.
