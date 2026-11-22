# The role contracts

Each of the seven **roles** of the loop is filled by `forge-sdlc:<role>` unless the host's **roster**, `docs/agents/forge.yaml`, names another agent under `roles.<role>.agent`. This file is what a replacement has to honour, written for the owner choosing one: the pointers its brief carries, the report its lead waits for, the evidence it leaves, and the hooks that hold it whoever fills the role. A swapped-in agent gets the same brief as the default plus one line, `role contract: <plugin root>/skills/build/ROLES.md#<role>`, pointing at its section here. The [member call](MEMBERS.md) is the same for every role. Read by path, this file keeps its plugin-root variable unresolved: read each `${CLAUDE_PLUGIN_ROOT}` below as the plugin root.

Every member is held by `context-budget` (a subagent's context past the host's `## Budgets` `agent_context` denies its next call; it reports what is left and its lead starts a continuation) and by `protected-branch` (no edit or commit on the default or a protected branch). ADR 0011's write scopes become the replacement's to honour.

## researcher

Default `forge-sdlc:researcher`, started by wayfinder for a `wayfinder:research` ticket and by build for its exploration step.

- **Inputs.** The effort `<slug>`, the question (a ticket pointer or a build brief) and the note path.
- **Report.** Three lines: the note path, the answer in one sentence, the hypotheses count.
- **Evidence.** The note, every finding linked to its primary source: `docs/research/<slug>/<topic>.md` (the dispatching session commits it on `feat/<slug>`) or `.forge/notes/<slug>/<topic>.md` (uncommitted, read by every implementer). Those two folders are its whole write scope.
- **Hooks.** `context-budget`.

## prototyper

Default `forge-sdlc:prototyper`, started by wayfinder for a `wayfinder:prototype` ticket, with `isolation: "worktree"` on the call. Calls the `prototyper.prototype` slot.

- **Inputs.** The effort `<slug>`, the ticket pointer and its question.
- **Report.** The verdict as its final message: `## Verdict`, `## Evidence` (one line per case run), `## Run it`, `## Gist`, ready to paste as the ticket's resolution and the map's gist.
- **Evidence.** None kept: the code is throwaway and goes with its worktree, nothing is pushed or merged, and nothing is committed to `feat/<slug>`. The lead posts the verdict on the ticket and the map.
- **Hooks.** `context-budget`, `protected-branch`.

## spec-writer

Default `forge-sdlc:spec-writer`, started by the spec skill once `intent.md` is committed with no open assumption. It has no Bash, so its slots, `spec-writer.codebase-design` and `policy`, reach it resolved in its prompt.

- **Inputs.** The slug, the to-spec file, SPEC-EXTRAS.md, `intent.md`, `map.md` and its closed tickets (when present), the glossary, the ADR folder, and the policy skills (or none).
- **Report.** Four lines: the spec path, the user-story count, the flagged concerns count, and the assumption lines as `<n> recommended, <n> open`.
- **Evidence.** `docs/efforts/<slug>/spec.md`, its only write, with the SPEC-EXTRAS frontmatter, every to-spec section and the three extras; the lead commits it for Gate 2.
- **Hooks.** `context-budget`; `spec-frozen` denies an edit to the spec once the effort is in build.

## implementer

Default `forge-sdlc:implementer`, started by build for a ticket on the frontier (in the background) and by slice-review to fix a round's Important findings. Calls the `implementer.tdd` slot.

- **Inputs.** The ticket, `docs/efforts/<slug>/spec.md`, `docs/efforts/<slug>/plan.md` row `<nn>` and its proof block, the effort branch `feat/<slug>`, the worktree on `slice/<slug>-<nn>`, `.forge/notes/<slug>/`; a fix adds the review record `.forge/review/<slug>-<nn>.md` and the round to fix.
- **Report.** Under 10 lines: the branch, the commits (`git log feat/<slug>..HEAD --oneline`), the record path and its `head`, each recorded assumption; on a context-budget deny, the behaviours not yet built.
- **Evidence.** Small conventional commits on `slice/<slug>-<nn>` with the effort tip merged in; the verify record `.forge/verify/<slug>-<nn>.json`, `green: true` at the worktree's HEAD, written by `bin/verify-record.mjs`; in fix mode, the red tests committed first and the slice's `mode` set to `fix`, then back to `normal`. The lead writes the slice's `agent` in `.forge/state.json`, by which the Stop gate finds it.
- **Hooks.** `verified-before-stop` (the Stop gate: no stop in a slice worktree without a fresh green record), `test-frozen` (no test edit in fix mode), `context-budget`, `spec-frozen`, `slice-push` (only `feat/*` is pushed), `secrets-in-diff`, `format-after-edit`. A replacement that skips `verify-record.mjs` is stopped exactly as the default would be.

## verifier

Default `forge-sdlc:verifier`, started by build when an implementer reports a slice done, and by slice-review after each fix round.

- **Inputs.** The slice `<slug>-<nn>`, the worktree path, the host project dir, the slice's proof command (or `none`).
- **Report.** Under 10 lines: the record path, `green` or `red`, the HEAD sha, and one line per run with a non-zero `exitCode` (its name, command and the last line of its tail as recorded).
- **Evidence.** `.forge/verify/<slug>-<nn>.json`, written by `bin/verify-record.mjs`, its one write; the worktree stays as it found it.
- **Hooks.** `context-budget`.

## reviewer

Default `forge-sdlc:reviewer`, started by slice-review, one call per axis. It changes nothing; its slot, `policy`, reaches it resolved in the Bugs and security prompt.

- **Inputs.** `Axis: Standards | Spec | Bugs and security`, the diff command `git diff <effort>...<slice>`, the worktree, and the sources of its axis (the code-review file; the spec and ticket; `review/REVIEW.md`, the host's `docs/agents/REVIEW.md` when named, and the policy skills).
- **Report.** Under 400 words: `## <axis>`, then `### Important` and `### Nit` (five at most), one line per finding naming file and hunk, the rule and a one-line fix; `- none` under an empty label.
- **Evidence.** None of its own: the lead appends its report verbatim to the review record.
- **Hooks.** `context-budget`.

## merger

Default `forge-sdlc:merger`, started by build, one call per slice whose implementer reported done. It reads evidence and runs nothing that tests the code.

- **Inputs.** The slice `<slug>-<nn>`, the worktree, the slice branch `slice/<slug>-<nn>`, the effort branch `feat/<slug>`, the project dir (on `feat/<slug>`), the ticket.
- **Report.** Two lines: `<slug>-<nn>: merged <sha>` or `<slug>-<nn>: red (<reason>)`, then the review record path (or `none`).
- **Evidence.** The review record `.forge/review/<slug>-<nn>.md` from slice-review; on clean, the `--no-ff` merge on `feat/<slug>`, the worktree and slice branch removed, the ticket closed with the record path and merge sha; on red, the ticket's `red` comment; either way the slice's `status` set and its `agent` cleared in `.forge/state.json`.
- **Hooks.** `context-budget`, `slice-push` (`feat/<slug>` is the only ref it pushes), `secrets-in-diff`, `protected-branch`.

## Slots

A **slot** is a named point where a role or stage calls a skill. The rule, the same at every call site: from the host, run `node "${CLAUDE_PLUGIN_ROOT}/bin/roster.mjs" <slot> --project <host>`, call the skill it prints, and skip the call when it prints `disabled`. For `policy` it prints the skill names comma-separated, each called in turn, or `none`, which calls none. A skipped call changes nothing else: the step still ends on its own "Done when". A member without Bash (the spec-writer, the reviewer) gets the printed skill as a pointer line from its lead, which runs the command for it. A required slot is never `disabled`: the roster reports the attempt and keeps the default.

| Slot | Default skill | Kind | Call site |
| --- | --- | --- | --- |
| `implementer.tdd` | `mattpocock-skills:tdd` | required | the implementer's Build step |
| `prototyper.prototype` | `mattpocock-skills:prototype` | required | the prototyper's Build the prototype step |
| `grilling` | `mattpocock-skills:grilling` | required | wayfinder's Destination and grilling tickets; intent's grilling |
| `spec-writer.codebase-design` | `mattpocock-skills:codebase-design` | optional | the spec-writer's Explore step, resolved by the spec skill |
| `domain-modeling` | `mattpocock-skills:domain-modeling` | optional | beside `grilling` in wayfinder and intent |
| `policy` | none, or the deprecated `## Policy skills` of `docs/agents/forge.md` | optional list | the spec-writer's policy step and the reviewer's Bugs and security axis |
