# 12: roster-as-code-07: Spec and slice-review resolve slots for their members

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** The spec skill resolves `spec-writer.codebase-design` and `policy` in step 1 and passes both as pointer lines; the spec-writer's prompt list gains the codebase-design line and its step 3 calls that skill or skips on `disabled`; slice-review resolves `policy` for the reviewer's Bugs and security prompt; the `## Policy skills` reading is replaced by the roster command.

**Blocked by:** roster-as-code-06

- [ ] spec passes the codebase-design slot and policy to the spec-writer
- [ ] the spec-writer calls or skips the codebase-design skill as passed
- [ ] slice-review passes the roster's policy skills

## Proof

```sh
node --test tests/roster-members.test.mjs tests/spec.test.mjs tests/slice-review.test.mjs
```

passes: the member-resolution checks and the existing spec and slice-review tests green

## Comments

- recommended: the spec skill runs the roster command with `--project .`, as wayfinder and intent do from the host checkout on `feat/<slug>`; slice-review runs it with `--project <project dir>`, as its worktree line already does (source: spec "The slot rule"; slice 06 ticket comment)
- recommended: ROLES.md's spec-writer **Inputs** line gains the codebase-design slot in slice 10's docs, as slice 06 recorded; this slice leaves ROLES.md as it is (source: spec "Role-contract reference"; slice 06 ticket comment)
- recommended: SPEC-EXTRAS.md's `## Flagged concerns` names the roster's `policy` slot instead of `## Policy skills`, so no spec-stage text points at the section slice 09 drops (source: spec "Init", "the `## Policy skills` reading in spec and slice-review is replaced")
- recommended: `tests/spec.test.mjs`'s relative-link check takes the file part of an anchored link (`../build/ROLES.md#slots`), as `tests/slice-review.test.mjs`'s already does (source: spec "Skill text tests")
