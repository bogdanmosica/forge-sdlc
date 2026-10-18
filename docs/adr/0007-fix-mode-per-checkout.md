# 7. Fix mode belongs to a checkout

Status: accepted, 2026-10-17

## Context

Design section 7 froze test files whenever `state.mode` was `fix`, one flag per effort. During a build several implementers work at once, each in its own slice worktree. A fix implementer on one slice would set the flag and freeze every other slice's tests mid-TDD.

## Decision

`mode` exists at two levels in `.forge/state.json`: the effort's (`efforts.<slug>.mode`, for the `diagnosing-bugs` flow in the main checkout) and each slice's (`efforts.<slug>.slices.<slug>-<nn>.mode`). The `test-frozen` hook resolves the edited file's checkout: on `slice/<slug>-<nn>` it reads that slice's mode, on `feat/<slug>` the effort's, on any other branch it stays quiet. The fix implementer sets its slice's mode to `fix` before touching code and back to `normal` after verifying.

## Consequences

- Parallel implementers keep editing their own tests while one slice is being fixed.
- `test-frozen` reads state from `CLAUDE_PROJECT_DIR`. A session whose project dir is a worktree sees no state and stays quiet; finding the main checkout through git, as `verified-before-stop` does, is the fix if that case appears.
