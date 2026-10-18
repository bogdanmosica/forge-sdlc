# 3. One pushed branch per effort, and the map and docs commit on it

Status: accepted, 2026-10-17

## Context

The playbook wants intent, spec and plan as committed artifacts and one PR as the gate record. The work plugin let the map stand in for the intent and the slice for the plan. The user asked for a single branch for the docs and the map, with slice branches local and never pushed.

## Decision

`feat/<slug>` is the effort branch and the only ref that reaches origin: `map.md`, `intent.md`, `spec.md`, `plan.md`, research notes and every merged slice commit on it, and the PR's state (draft, then ready) is the gate record. Slices are local branches `slice/<slug>-<nn>` in their own worktrees, merged `--no-ff` and deleted; prototypes are discarded; the `slice-push` hook denies pushing any other ref.

## Consequences

- The PR is the only thing origin sees; the human merges it.
- A red slice keeps its branch and worktree for its implementer and is listed in the PR body, never pushed.
