# 28. chore/* and fix/* branches are pushed outside an effort

Status: accepted, 2026-11-26; amends ADR 0003

## Context

ADR 0003 made `feat/<slug>` the only ref that reaches origin on a configured host, and the `slice-push` hook denies every other one. Not every change is an effort: removing a feature's leftovers, a one-line test fix or a dependency bump has no intent, spec or plan to write, yet it still needs its own PR. On 2026-11-26 the hook blocked `git push origin chore/remove-cmux` in this repository, a chore branch with an open PR, and the only way through was to push by hand outside the session.

## Decision

- On a configured host, `slice-push` passes a push whose ref matches `chore/*` or `fix/*`, as well as the effort glob. These are branches outside an effort: each carries its own PR and never holds an effort's artifacts or slices.
- The shapes are fixed, like the effort's and the slice's (`OUTSIDE_EFFORT_BRANCHES` in `hooks/scripts/lib.mjs`), not a `## Branches` key: `init` asks nothing new and the run pane's config parser is unchanged.
- Slice branches, the default branch, any other ref, `--all` and `--mirror` stay denied. The deny reason names the `chore/` and `fix/` way out.
- Without `docs/agents/forge.md` nothing changes: only `slice/*` was denied, and still is.

## Consequences

- A chore or a fix can be pushed from a session without starting an effort. The `slice-push-chore-allowed` guardrail case holds it.
- Nothing ties a `fix/*` branch to an effort: a fix that belongs to an effort still lands on `feat/<slug>`, by the build's own steps.
- The same change is owed to emag-sdlc's copy of the hook.
