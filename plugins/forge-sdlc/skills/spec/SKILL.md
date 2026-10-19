---
name: spec
description: Turn an effort's committed intent into docs/efforts/<slug>/spec.md through the spec-writer agent, commit it on feat/<slug>, link it from the tracker and the PR, and stop at Gate 2 for the owner's approval.
disable-model-invocation: true
argument-hint: <slug>
---

`/forge-sdlc:spec <slug>` is the Design stage. The procedure and template are Matt's `to-spec`, read by file; the **spec-writer** agent synthesises from them, asking nothing. This skill is the frame: preconditions, the commit, the tracker link, the gate record, the state.

## 1. Precondition

- The checkout is on `feat/<slug>` and `docs/efforts/<slug>/intent.md` is committed there (`git log -1 -- docs/efforts/<slug>/intent.md` prints a commit).
- `intent.md` has no `open:` assumption line. Each one is a question only the owner settles: print every `open:` line verbatim and stop; the owner answers by editing intent.md (`recommended:` with a source), then reruns this command.
- `node "${CLAUDE_PLUGIN_ROOT}/bin/skill-path.mjs" to-spec` prints the to-spec file. Exit 1 stops with the install line it printed.
- `node "${CLAUDE_PLUGIN_ROOT}/bin/forge-config.mjs"` prints the host config; keep `gates.spec` (missing means `always`). Read the `## Policy skills` bullets of `docs/agents/forge.md` as the policy skill list (or none).
- The human typing this command accepts Gate 1: when intent.md's frontmatter reads `status: draft`, set `status: accepted`; it commits with the spec in step 3.

Anything missing stops with one line naming it and the command that produces it (`/forge-sdlc:wayfinder <slug>`). Done when intent.md is committed with no `open:` line and you hold the to-spec path, the spec gate and the policy skills.

## 2. Spawn the spec-writer

One [member call](../build/MEMBERS.md), role `spec-writer`, foreground under a plain lead, `subagent_type: "forge-sdlc:spec-writer"`, with this session its lead: read that file by path, which keeps its plugin-root variable unresolved, and Bash has no such variable: read each one in it as `${CLAUDE_PLUGIN_ROOT}`. The prompt is pointers only, one per line, absolute paths:

- slug, and the output `docs/efforts/<slug>/spec.md`
- the to-spec file from step 1, and `${CLAUDE_PLUGIN_ROOT}/skills/spec/SPEC-EXTRAS.md` resolved
- `docs/efforts/<slug>/intent.md`; `docs/efforts/<slug>/map.md` and its closed tickets' pointers, when the map exists
- `GLOSSARY.md` (or the glossary `docs/agents/` names) and `docs/adr/`, when present
- the policy skills by name, or `none`

The frontmatter, the three added sections and the assumption lines are defined in [SPEC-EXTRAS.md](SPEC-EXTRAS.md). Done when spec.md exists with that frontmatter and `## Affected users and systems`, `## Flagged concerns`, `## Assumptions to confirm` each present; otherwise send the agent the missing piece and wait again.

## 3. Commit

Commit `docs/efforts/<slug>/spec.md` (with intent.md when step 1 accepted it) on `feat/<slug>`: `spec(<slug>): <n> user stories`. Push `feat/<slug>` when origin exists. Done when `git log -1 -- docs/efforts/<slug>/spec.md` prints the commit.

## 4. Tracker issue

Publish one issue as `docs/agents/issue-tracker.md` prescribes: title `<slug>: spec`, body a link to `docs/efforts/<slug>/spec.md` on `feat/<slug>` (the path, never the spec text), label `ready-for-agent`. A rerun updates the issue it published before. Done when the tracker shows the issue with the link and the label.

## 5. Gate record

Rewrite only these PR body sections and keep every other section verbatim (`gh pr view --json body`, edit, `gh pr edit --body-file`):

- `## Spec`: the link to spec.md and its user-story count.
- `## Flagged concerns`: the spec's bullets, verbatim.
- `## Assumptions to confirm`: the spec's assumption lines, `open` first.

`risk: high` in the spec frontmatter: also `gh pr edit --add-label needs-tech-lead`. Without a remote the same sections go into `docs/efforts/<slug>/PR.md`, committed on `feat/<slug>`. Done when the PR body (or PR.md) reads back the three sections.

## 6. State

With `readState` and `writeState` from `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/lib.mjs` (`node --input-type=module -e`), set the effort in `.forge/state.json` to `stage: spec`, `gate: spec`, `risk` from the spec frontmatter, `updatedAt` now; every other field kept. Done when the state reads back `stage: spec`, `gate: spec`.

## 7. Gate 2

Stop at Gate 2 when any holds: the spec gate is `always`; the spec has an `open:` line; `## Flagged concerns` has a bullet other than `- none`; the effort is `risk: high`. Otherwise (`only-on-open`, clean, normal risk) the gate passes on its own and `/forge-sdlc:wayfinder` continues into plan.

Report in three lines: the spec commit and issue link, the counts (user stories, flagged concerns, open assumptions), and either `Gate 2: <the reasons>; approve, then /forge-sdlc:plan <slug>` or `Gate 2 passed: only-on-open, nothing open`. Done when the report is printed.
