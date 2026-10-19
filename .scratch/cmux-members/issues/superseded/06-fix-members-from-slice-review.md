# 06: cmux-members-06: Fix members from slice-review

Type: slice
Status: withdrawn (to be rewritten at plan after ticket 07)
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** A fix round is as visible as a first build. Slice-review's fix step closes the slice's previous member, dispatches the fix implementer through the shared dispatch reference, and awaits a member fix in the foreground with `--timeout 540`, rerun on exit 2 until settled; its completion criterion becomes "the implementer reported or `crew.mjs await` settled, and the slice branch has a commit after the reviewed sha". The implementer's step 1 keeps "your first Bash call is `cd <worktree>`" with its reason reworded to hold in both transports. The merger agent is unchanged.

**Blocked by:** 05 (Build dispatches members)

- [ ] Slice-review names the close-then-spawn, the shared dispatch file, the foreground await with its timeout and the rerun rule
- [ ] The implementer still says the first Bash call is `cd <worktree>` and never learns its transport
- [ ] The merger agent file is unchanged apart from nothing

## Proof

`node --test tests/slice-review.test.mjs tests/agents.test.mjs` → passes with the fix dispatch rules
