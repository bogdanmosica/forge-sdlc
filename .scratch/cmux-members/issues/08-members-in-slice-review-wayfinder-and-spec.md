# 08: cmux-members-08: Members in slice-review, wayfinder and spec

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** Every other agent the loop starts is a member too. Slice-review's three reviewer calls take role `reviewer`, its verifier call `verifier`, and its fix implementer is a member call with role `implementer` and `--slice`, run in the foreground inside the merger with no `agent` write, so the merger's verify step is the gate of a fix round; the step's completion criterion stays (the implementer reported and the slice branch has a commit after the reviewed sha). Wayfinder's research tickets are member calls with role `researcher`; its prototyper is a member call with role `prototyper` that also passes `isolation: "worktree"` on the call, so it stays a subagent in its own worktree under a teams lead. The spec stage's spec-writer is a member call with role `spec-writer`. Each skill points to the members reference by name at the call, naming the role.

**Blocked by:** 07 (Members reference and the build stage)

- [ ] Slice-review names the foreground fix call with `--slice` and no `agent` write, and the reviewer and verifier roles
- [ ] Wayfinder's researcher calls carry the role and its prototyper call passes `isolation`
- [ ] Spec's spec-writer call carries the role; all three skills link the members reference
- [ ] No skill says "teammate" or "task notification" outside the reference

## Proof

`node --test tests/slice-review.test.mjs tests/wayfinder.test.mjs tests/spec.test.mjs` → passes with the member calls

## Comments

red 2026-10-19: blocked by a red slice. Slice 05 (crew-name.mjs) ended red after two fix rounds with one Important finding left (a missing test for the `updatedAt` write, see `.forge/review/cmux-members-05.md`); this slice was not started. The next build run retries 05 first.

building 2026-10-19: the red note above is superseded; slices 05 and 07 merged on `feat/cmux-members` and this slice was built on `slice/cmux-members-08`.

red: slice-review ended red after 2 fix rounds (Standards, Spec, Bugs and security). One cause: step 4.1 of slice-review/SKILL.md accepts "or the verifier's record for it is fresh" as a second way to finish waiting, which contradicts its Done line and spec line 107. Findings: .forge/review/cmux-members-08.md

## Assumptions
- recommended: slice-review, wayfinder and spec each carry build's by-path sentence at their member calls and name the session running the skill as the lead (the merger, or the owner by hand, for slice-review) (source: spec, Implementation Decisions, "Here the merger is the lead of the reference"; MEMBERS.md, "read by path and keeps its plugin-root variable unresolved")
- recommended: the reviewer, verifier and spec-writer calls keep "foreground under a plain lead", as build's do, since the reference makes every member background under a teams lead (source: spec, "Under a plain lead a call is foreground or background as the skill says")
- recommended: the "no teammate or task notification" guard is repeated in each of the three skills' own tests, so the slice's proof checks it; `tests/build.test.mjs` still guards every skill (source: ticket 08, fourth criterion)
- recommended: slice-review keeps the fix implementer as one foreground Agent call inside the merger, as before this effort; the background call with the `agent` write before the wait is dropped, and the clause "or the verifier's record for it is fresh" goes with it, so step 4.1 has one completion line: the implementer reported and the slice branch has a commit after the reviewed sha. The agent-id Stop gate therefore does not hold for fix rounds; the merger's verifier step stays the gate there. (source: owner decision at Gate 4, 2026-10-19, option 1, overriding spec "Slice-review skill"; .forge/review/cmux-members-08.md rounds 1 and 2)

- merged c8ee204: review record /Users/mosica.bogdan/Desktop/personal/forge-sdlc/.forge/review/cmux-members-08.md (verdict clean after the owner's foreground fix decision)
