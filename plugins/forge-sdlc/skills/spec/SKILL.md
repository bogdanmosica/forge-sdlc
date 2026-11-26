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
- `node "${CLAUDE_PLUGIN_ROOT}/bin/workflow.mjs" --gate spec --project .` prints Gate 2's `{ key, n, mode, source, stops }`; keep it, read as the [gate policy](../wayfinder/GATE-POLICY.md) says.
- The spec-writer has no Bash, so resolve its slots for it, per the [slot rule](../build/ROLES.md#slots): the `spec-writer.codebase-design` slot's skill (default `mattpocock-skills:codebase-design`, or `disabled`) is the line `node "${CLAUDE_PLUGIN_ROOT}/bin/roster.mjs" spec-writer.codebase-design --project .` prints, and the policy skill list (comma-separated, or `none`) is the line `node "${CLAUDE_PLUGIN_ROOT}/bin/roster.mjs" policy --project .` prints: the roster's `slots.policy`, with its fallback to the deprecated `## Policy skills` of `docs/agents/forge.md`.
- The human typing this command, or the policy passing Gate 1 (mode `policy`), accepts Gate 1: when intent.md's frontmatter reads `status: draft`, set `status: accepted`; it commits with the spec in step 3.

Anything missing stops with one line naming it and the command that produces it (`/forge-sdlc:wayfinder <slug>`). Done when intent.md is committed with no `open:` line and you hold the to-spec path, Gate 2 as the gate policy reads it, the codebase-design slot's skill and the policy skills.

## 2. Spawn the spec-writer

One [member call](../build/MEMBERS.md), role `spec-writer`, foreground under a plain lead, `subagent_type: "forge-sdlc:spec-writer"`, with this session its lead: read that file by path, which keeps its plugin-root variable unresolved, and Bash has no such variable: read each one in it as `${CLAUDE_PLUGIN_ROOT}`. The prompt is pointers only, one per line, absolute paths:

- slug, and the output `docs/efforts/<slug>/spec.md`
- the to-spec file from step 1, and `${CLAUDE_PLUGIN_ROOT}/skills/spec/SPEC-EXTRAS.md` resolved
- `docs/efforts/<slug>/intent.md`; `docs/efforts/<slug>/map.md` and its closed tickets' pointers, when the map exists
- `GLOSSARY.md` (or the glossary `docs/agents/` names) and `docs/adr/`, when present
- the `spec-writer.codebase-design` slot's skill from step 1, or `disabled`
- the policy skills from step 1 by name, or `none`

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

With `readState` and `writeState` from `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/lib.mjs` (`node --input-type=module -e`), set the effort in `.forge/state.json` to `stage: spec`, `gate: spec`, `risk` from the spec frontmatter, `updatedAt` now, dropping `stop`; every other field kept. Done when the state reads back `stage: spec`, `gate: spec`.

## 7. Gate 2

Apply the [gate policy](../wayfinder/GATE-POLICY.md) to the Gate 2 read in step 1: gate key `spec`, artifact spec.md, next command `/forge-sdlc:plan <slug>`. A passed gate lets `/forge-sdlc:wayfinder` continue into plan. A stop writes `stop: <reason>` to the effort as step 6 writes state, where the reference's State write says. Then, after step 6's state write and any stop, rewrite only the PR body's `## Workflow` section: the output of `node "${CLAUDE_PLUGIN_ROOT}/bin/workflow.mjs" --mermaid --effort <slug> --project .` in a fenced `mermaid` block, every other section verbatim (`gh pr view --json body`, edit, `gh pr edit --body-file`). Without a remote the section goes into `docs/efforts/<slug>/PR.md`, committed on `feat/<slug>`.

Report in three lines: the spec commit and issue link, the counts (user stories, flagged concerns, open assumptions), and the gate line, picked by the first of the gate's `stops` that holds, as the reference's Report line says:

- mode `policy`, passed: the reference's report line, `Gate 2 passed: <tail>, nothing open`.
- stopped by `open`, `flagged` or `risk-high`, whatever the mode: the reasons and `/forge-sdlc:wayfinder <slug>` to resume, as the reference's Report line says.
- stopped by mode `attended`, none of those holding: `Gate 2:`, then the next move with the gate's `source`: the owner reads spec.md, then approves it by running `/forge-sdlc:plan <slug>`.

Done when the PR body (or PR.md) holds the `## Workflow` section, the report is printed and, after a stop the reference's State write records, the state reads back `stop: <reason>`.
