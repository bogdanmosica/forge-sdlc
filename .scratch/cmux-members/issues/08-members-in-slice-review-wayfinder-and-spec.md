# 08: cmux-members-08: Members in slice-review, wayfinder and spec

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** Every other agent the loop starts is a member too. Slice-review's three reviewer calls take role `reviewer`, its verifier call `verifier`, and its fix implementer is a member call with role `implementer` and `--slice`, run in the background so the merger writes the slice's `agent` before the implementer can stop, then waits for its report; the step's completion criterion stays (the implementer reported and the slice branch has a commit after the reviewed sha). Wayfinder's research tickets are member calls with role `researcher`; its prototyper is a member call with role `prototyper` that also passes `isolation: "worktree"` on the call, so it stays a subagent in its own worktree under a teams lead. The spec stage's spec-writer is a member call with role `spec-writer`. Each skill points to the members reference by name at the call, naming the role.

**Blocked by:** 07 (Members reference and the build stage)

- [ ] Slice-review names the background fix call with `--slice`, the `agent` write before the wait, and the reviewer and verifier roles
- [ ] Wayfinder's researcher calls carry the role and its prototyper call passes `isolation`
- [ ] Spec's spec-writer call carries the role; all three skills link the members reference
- [ ] No skill says "teammate" or "task notification" outside the reference

## Proof

`node --test tests/slice-review.test.mjs tests/wayfinder.test.mjs tests/spec.test.mjs` → passes with the member calls

## Comments

red 2026-10-19: blocked by a red slice. Slice 05 (crew-name.mjs) ended red after two fix rounds with one Important finding left (a missing test for the `updatedAt` write, see `.forge/review/cmux-members-05.md`); this slice was not started. The next build run retries 05 first.

red: slice-review ended red after 2 fix rounds (Standards, Spec, Bugs and security). One cause: step 4.1 of slice-review/SKILL.md accepts "or the verifier's record for it is fresh" as a second way to finish waiting, which contradicts its Done line and spec line 107. Findings: .forge/review/cmux-members-08.md
