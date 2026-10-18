# 02: cmux-members-02: Guardrail hooks find the host state through git

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Risk: high (touches plugins/forge-sdlc/hooks/**)
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** A session whose project dir is a slice worktree, as a member's is, is still held by the guardrails: `test-frozen` denies a test edit in fix mode and `spec-frozen` denies a frozen spec edit, because both read `.forge/state.json` from the parent of the edited file's checkout's git common dir, falling back to the project dir outside a repo (the fix ADR 0007 names). A subagent host sees no change. `verified-before-stop` gains the subfolder-cwd case. Each changed hook's guardrail eval case gains a `seam.json` for the member shape. Design section 7 gets its Decision line.

**Blocked by:** None (can start immediately)

- [ ] With `CLAUDE_PROJECT_DIR` set to the slice worktree, a fix-mode test edit is denied and a frozen spec edit is denied; existing host-dir cases stay green
- [ ] A Stop payload with a subfolder of the worktree as cwd blocks without a record and passes with a green one
- [ ] The eval cases for test-frozen and spec-frozen carry the member-shaped seam and `tests/evals.test.mjs` runs them green
- [ ] Deny reasons name the path or pattern, never a matched value

## Proof

`node --test tests/test-frozen.test.mjs tests/spec-frozen.test.mjs tests/verified-before-stop.test.mjs tests/evals.test.mjs` → passes with the member-shaped cases

## Assumptions

- recommended: the member-shaped seams are two new guardrail cases, `test-frozen-member-denied` and `spec-frozen-member-denied`, each with its own `seam.json` naming an optional `projectDir` (a slice worktree under the workspace) that `tests/evals.test.mjs` passes as `CLAUDE_PROJECT_DIR` and cwd, because a case folder holds one `seam.json` and the slice-mode reason needs its own `hook-*` grader (source: spec line 110, "Each hook's guardrail eval case gains a `seam.json` for the member shape")
- recommended: the lookup is one helper, `hostDirOf(dir, fallback)` in `lib.mjs`; `verified-before-stop` keeps its own expression unchanged (source: spec line 91, "`verified-before-stop` needs no change")
- recommended: the test helper `hook()` takes a `cwd`, and the empty-payload Stop case runs with cwd `/`: run from a slice worktree, as the proof is, it gated the real slice and wrote denials into the host's `.forge/verify/` (source: ticket, "existing host-dir cases stay green")
