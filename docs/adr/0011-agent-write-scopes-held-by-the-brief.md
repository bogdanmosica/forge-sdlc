# 11. Agent write scopes are held by the brief

Status: accepted, 2026-10-17

## Context

Design section 6 gives three agents narrow write scopes: the researcher writes under `docs/research/` and `.forge/notes/`, the spec-writer writes only `spec.md`, and the verifier writes only `.forge/verify/`. Agent frontmatter scopes tools, not paths. Design section 7 has no hook for agent paths.

## Decision

Each scope is a rule in the agent's brief, backed by its tool list:
- the researcher has no Bash, so the session that dispatched it commits its note together with the `map.md` re-commit. This also keeps parallel background researchers from committing to one checkout at once;
- the spec-writer has `Read, Glob, Grep, Write, Skill`;
- the verifier has `Bash, Read`, and its only write is through `bin/verify-record.mjs`.

## Consequences

A path outside the scope is caught in review, not refused by a hook. A path-scoping hook keyed on the agent type is a v2 candidate if a run shows the need.
