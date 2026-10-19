---
name: status
description: Print where forge-sdlc efforts stand (stage, gate, next command, gate policy and what stopped the run, ticket frontier, red slices, slice worktrees) for one effort or every effort on the host. Read-only.
disable-model-invocation: true
argument-hint: "[slug]"
---

`/forge-sdlc:status [slug]` is **read-only**: every command it runs prints, and the state file, the tracker and git stay exactly as they were.

## 1. Where each effort stands

`node "${CLAUDE_PLUGIN_ROOT}/bin/effort-state.mjs" . <slug>` for one effort, `node "${CLAUDE_PLUGIN_ROOT}/bin/effort-state.mjs" --list .` for all. Exit 1 prints its line and ends the run.

Done when you hold `stage`, `gate`, `next`, `source`, `policy` and `stop` for each effort (an empty list: print `no effort in progress` and end).

## 2. Per effort

- **Frontier**: the effort's open tickets whose blockers are all closed, by the query `docs/agents/issue-tracker.md` gives for the tracker in use. Before `plan` these are the map's `wayfinder:*` tickets; from `plan` on, the slice tickets of `.forge/state.json`.
- **Red slices**: entries of `efforts.<slug>.slices` in `.forge/state.json` with `status: red`, each with its ticket and the last `## Verdict` line of `.forge/review/<slug>-<nn>.md` when that file exists.
- **Worktrees**: `git worktree list --porcelain` entries under `.forge/worktrees/<slug>-`, each with its branch.

Done when every effort has a frontier, red slices and worktrees, each a list or `none`.

## 3. Print

One block per effort:

```text
<slug>: stage <stage>, gate <gate>, next <next>, policy <policy>, stopped: <stop> (<why>)
  frontier: <ticket> <title>, ... | none
  red: <slug>-<nn> <ticket> <verdict> | none
  worktrees: .forge/worktrees/<slug>-<nn> <branch> | none
```

Any `next` but `none` resumes with `/forge-sdlc:wayfinder <slug>`; print that line under the block. Leave out `, stopped: <stop>` when `stop` is `none`. `source: artifacts` adds `(state lost; re-derived from feat/<slug>)` to the first line.

Done when every effort's block is printed.
