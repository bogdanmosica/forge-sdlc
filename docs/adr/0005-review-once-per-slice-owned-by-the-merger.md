# 5. Review happens once per slice, owned by the merger, on three axes

Status: accepted, 2026-10-17

## Context

`implement-spec` ends with one `code-review` over the whole integration branch, after every ticket is merged. By then a wrong slice has already landed, and one review over many slices loses the Standards and Spec separation Matt's skill is built on.

## Decision

Every slice is reviewed when it is merged: the merger runs `slice-review`, which spawns three reviewer agents in parallel, one axis each (Standards, Spec, Bugs and security from `review/REVIEW.md` plus the host's `docs/agents/REVIEW.md`), reported side by side and never reranked. Important findings go to one fix implementer in the same worktree; the verifier reruns; two rounds, then the slice is red. Step 7 of `implement-spec` is replaced, not duplicated: the PR body carries the evidence instead.

## Consequences

- A wrong slice never reaches the effort branch.
- Three Opus reviewers per merge is the main cost knob, beside `max_parallel_slices`.
