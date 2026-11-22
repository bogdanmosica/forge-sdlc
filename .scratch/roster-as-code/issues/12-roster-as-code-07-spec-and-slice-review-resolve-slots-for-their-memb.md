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
