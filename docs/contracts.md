# Shared contracts

The shapes every slice of the build order (design, section 15) agrees on, so slices built in parallel fit. The design says what each piece does; this file fixes the names and schemas they share. Change a contract here first, then the code.

## Names

| Thing | Name |
| --- | --- |
| Effort slug | kebab-case, from the map title; `<slug>` below |
| Effort branch | `feat/<slug>` (host config `branches.effort`, glob via `globOfShape`) |
| Slice branch | `slice/<slug>-<nn>`, `nn` two digits from `01`, the ticket's order in `plan.md` |
| Slice worktree | `.forge/worktrees/<slug>-<nn>` in the host, branch above, the host's dependency dir (`## Worktrees` / `dependency_dir` in forge.md, default: whichever of `node_modules`, `.venv`, `vendor` exists) symlinked from the host |
| Effort folder | `docs/efforts/<slug>/` with `map.md`, `intent.md`, `spec.md`, `plan.md` |
| Research notes | `docs/research/<slug>/<topic>.md`, committed on the effort branch |
| Exploration notes for a build | `.forge/notes/<slug>/*.md`, not committed |
| Verify record | `.forge/verify/<slug>-<nn>.json`, written by `node "${CLAUDE_PLUGIN_ROOT}/bin/verify-record.mjs" --slice <slug>-<nn> --worktree <path> --project <host> --proof "<proof>"` (exit 0 green, 1 red, 2 bad usage); the Stop hook's block count beside it as `<slug>-<nn>.denials` |
| Review record | `.forge/review/<slug>-<nn>.md` |
| Effort position | `node "${CLAUDE_PLUGIN_ROOT}/bin/effort-state.mjs" [host] <slug>` prints `{ slug, stage, gate, next, why, source, policy, stop }` (`--list [host]` for every effort); `source` is `state`, or `artifacts` when re-derived from `feat/<slug>`; `policy` is the host's gate policy read from `## Gates` of forge.md on each call (`attended` or `autonomous`, `attended` when the key is missing or any other value); `stop` is the state's `stop` (`open`, `flagged`, `risk-high`), or `none` when absent or when `source` is `artifacts` |
| Agent types | `forge-sdlc:researcher`, `forge-sdlc:prototyper`, `forge-sdlc:spec-writer`, `forge-sdlc:implementer`, `forge-sdlc:verifier`, `forge-sdlc:reviewer`, `forge-sdlc:merger` |
| Member name | `node "${CLAUDE_PLUGIN_ROOT}/bin/crew-name.mjs" <role> --project <host> --effort <slug> [--slice <slug>-<nn>]` prints one line, the next name of the role's pool in handle form (letters, digits, `_`, `-`), and records it in state (exit 0; 2 on bad usage, such as an `--effort` not a slug (lowercase letters and digits joined by single `-`), or a `--slice` off an implementer or not `<effort>-<nn>` of its `--effort`). Roles: `researcher`, `prototyper`, `spec-writer`, `implementer`, `verifier`, `reviewer`, `merger`, `general`. Pool: the host's `names.<role>` bullet under `## Crew`, else the preset its `theme` names, else the fallback `<slug>-<nn>` for an implementer with `--slice` and `<role>` otherwise; a pool run out restarts with `-2`, `-3` |
| Crew presets | `crew.json` in the plugin root: `presets.<id>` for the ids `warcraft`, `star-trek`, `star-wars`, `got`, `mario`, each `{ label, names: { <role>: [names] } }` with one pool per role above, names in display form; read by `crew-name.mjs` and init |
| Upstream skills | `mattpocock-skills:<name>` through the Skill tool; user-invoked ones by file through `node "${CLAUDE_PLUGIN_ROOT}/bin/skill-path.mjs" <name>` |

## `.forge/state.json`

Written by the commands at every stage boundary, read by the hooks and `status`. One file per host. Missing file: no effort is in progress and every hook that reads a stage stays quiet.

```json
{
  "version": 1,
  "efforts": {
    "<slug>": {
      "stage": "map | intent | spec | plan | build | built",
      "gate": "none | intent | spec | plan | pr",
      "stop": "open | flagged | risk-high",
      "mode": "normal | fix",
      "risk": "normal | high",
      "branch": "feat/<slug>",
      "pr": { "number": 12, "url": "https://..." } ,
      "slices": { "<slug>-01": { "status": "open | building | verified | merged | red", "mode": "normal | fix", "ticket": "#45 or .scratch/<slug>/issues/01-x.md", "member": "Scotty", "agent": "<id of its current implementer>" } },
      "crew": { "<role>": ["Scotty", "Miles-OBrien"] },
      "updatedAt": "2026-10-17T10:00:00Z"
    }
  }
}
```

- `stage` is the last stage that has an artifact; `gate` is the gate the effort waits at (`none` while a stage runs). `wayfinder <slug>` resumes from `stage` and `gate`.
- `stop` is optional: why a run under the `autonomous` gate policy stopped at `gate`, one of `open` (an `open:` line in intent.md or spec.md), `flagged` (a flagged concern in spec.md), `risk-high` (the effort runs attended). A stage that stops by policy writes it beside `gate`; every other stage write drops it. It is additive: an absent `stop` reads as none, and no migration runs.
- `pr` is `null` on a host without a remote.
- `mode` exists at two levels. The effort's `mode: fix` is for work in the main checkout (the `diagnosing-bugs` flow on `feat/<slug>`). A slice's `mode: fix` is set by the fix implementer for that slice only, so parallel implementers on other slices keep editing their tests. The `test-frozen` hook resolves the edited file's checkout: inside a slice worktree it reads that slice's `mode`; in the main checkout it reads the effort's.
- `crew` holds, per role, the handle-form names `crew-name.mjs` has handed out in this effort; a slice's `member` is its implementer's name, kept across fix rounds and resumes, and written by `crew-name.mjs --slice`. A slice's `agent` is the id the Agent result named for its current implementer, written by the lead (or the merger, for a fix round) right after the call and cleared when the slice goes `merged` or `red`; the `verified-before-stop` hook reads it to find the slice a stopping subagent built. All three are additive: an absent field reads as none, and no migration runs.
- The helper for reading and writing it is `hooks/scripts/lib.mjs`: `readState(projectDir)` (null when missing), `writeState(projectDir, state)` (atomic: temp file then rename), `effortOf(state, slug)`.

## `.forge/verify/<slug>-<nn>.json`

Written by `bin/verify-record.mjs` only, run by the implementer before it stops or by the verifier agent. Read by the `verified-before-stop` hook, `build`, slice-review and the PR body.

```json
{
  "slice": "<slug>-<nn>",
  "head": "<40-char sha of the worktree HEAD when the run started>",
  "at": "2026-10-17T10:00:00Z",
  "green": true,
  "runs": [
    { "name": "proof", "command": "pnpm vitest run src/checkout", "exitCode": 0, "ms": 1200, "tail": "last 20 lines of output" },
    { "name": "test", "command": "pnpm test --run", "exitCode": 0, "ms": 9000, "tail": "..." },
    { "name": "typecheck", "command": "pnpm tsc --noEmit", "exitCode": 0, "ms": 4000, "tail": "..." }
  ]
}
```

- `green` is true only when there is at least one run and every run exited 0. `runs` always has the slice's `proof` first, then the host's proof commands in config order (`test`, `typecheck`, `lint`, `build`), skipping ones set to `none`.
- The Stop hook calls the record **fresh** when `head` equals the worktree's current `HEAD`. A commit after the run makes it stale.
- `tail` is trimmed to 20 lines and never contains a value matching a secret pattern (the verifier masks with `[REDACTED]`).

## Assumption lines

Used in `intent.md`, `spec.md` and the PR body under `## Assumptions to confirm`. One line each, in a bullet list:

```markdown
- recommended: <the reading taken> (source: <ticket name, doc, or "none">)
- open: <the question only the owner can settle>
```

`recommended` lets the stage continue; `open` stops the front door at the gate. The effort's risk is the `risk:` field of the artifact frontmatter below, `high` or `normal`, computed when `intent.md` is written and copied into `map.md`, `spec.md` and `plan.md`.

## Artifact frontmatter

Every artifact in `docs/efforts/<slug>/` (`map.md`, `intent.md`, `spec.md`, `plan.md`) opens with YAML frontmatter; `PR.md` is the PR body and has none:

```yaml
---
effort: <slug>
stage: map | intent | spec | plan
status: draft | accepted
risk: normal | high
updated: 2026-10-17
---
```

`status: accepted` is written when the gate passes. The `spec-frozen` hook reads the effort's `stage` from `state.json`, not from this frontmatter.

## PR body sections

Owned sections, in order, each a `## ` heading. A command rewrites only the sections it owns and keeps every other section verbatim.

| Section | Written by | Content |
| --- | --- | --- |
| `## Intent` | wayfinder | the Destination, under the intent headings |
| `## Assumptions to confirm` | wayfinder, then spec | the assumption lines, `open` first |
| `## Spec` | spec | a link to `spec.md` and the user-story count |
| `## Flagged concerns` | spec | the spec's bullets, verbatim |
| `## Plan` | plan | the slice table: nn, title, blocked by, proof |
| `## Summary`, `## Evidence`, `## Merge Danger` | build | the `pr` template, Evidence one bullet per slice from its verify record |
| `## Red slices` | build | one line per red slice with its ticket and reason, or `none` |

Local tracker (no remote): the same text is written to `docs/efforts/<slug>/PR.md` instead, so the gate record exists.

## Hooks

- One script per rule under `hooks/scripts/`, built on `lib.mjs` (`run`, `allow`, `deny`, `readHostConfig`, `branchRules`, `readState`). PreToolUse decisions use `deny`; Stop decisions use `block(reason)` (`{ decision: 'block', reason }`), and a stop let through after the third block carries only a `systemMessage`; SessionStart uses `systemMessage` + `additionalContext`.
- Every script is registered in `hooks/hooks.json` with `"command": "node"`, `"args": ["${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<name>.mjs"]`, a `timeout`. The manifests test fails on an unregistered script.
- A reason names the branch, path, rule or pattern and what to do instead. A matched secret value is never quoted.

## Agents

Files in `agents/<name>.md` with frontmatter `name`, `description` (what it does and when to use it, one sentence each), `model` (`claude-opus-5-5` or `claude-sonnet-5-5`), `effort` (`low | medium | high`), and tool scoping as the design's section 6 table says (`disallowedTools` for a blacklist, `tools` for a whitelist). The body is the brief: numbered steps, each ending on a completion criterion, under one screen. Prompts to an agent are pointers (paths, ticket ids, branch names), never pasted artifacts.

## Skills

`skills/<name>/SKILL.md` with `name`, `description`, `disable-model-invocation: true` (every forge-sdlc command is user-invoked), `argument-hint` when it takes arguments. Templates live beside the skill as `*.md` and are referenced by relative link. Upstream procedures are read by file, never copied.

## Tests

`tests/<piece>.test.mjs` with `node:test`. Hooks are tested at the stdin/stdout boundary through `tests/support/host.mjs` (`host`, `hook`, `edit`, `bash`); the upstream through `tests/support/upstream.mjs` (`fakeUpstream`, `fakeConfigDir`, `envWith`). Skills and agents are tested for structure: frontmatter fields, the headings and pointers the design requires, every referenced file exists. A fixture host that needs `state.json` writes it with `writeState`.
