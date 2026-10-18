---
effort: cmux-members
stage: plan
status: accepted
risk: high
updated: 2026-10-18
---

# Plan: Visible implementers as cmux members

Spec: [spec.md](spec.md). Tickets: `.scratch/cmux-members/issues/01-…06-*.md` (the resolved wayfinder tickets 01 and 02 of the map sit beside them, labelled `wayfinder:research`). The tracker carries the live state (claims, frontier, closed); this file is the approved breakdown.

## Slices

| nn | title | blocked by | delivers | proof |
| --- | --- | --- | --- | --- |
| 01 | Crew section and member field in the contracts | none | `## Crew` in forge.md, the init template and init; `member` on a slice and a `crew.mjs` row in the contracts; design sections 8 and 9; the eval scaffold pinned to `mode: agent` | `node --test tests/config.test.mjs` → passes with `crew.mode` and `crew.script` parsed from this repo's forge.md and the template |
| 02 | Guardrail hooks find the host state through git | none | `test-frozen` and `spec-frozen` hold in a member whose project dir is the worktree; a subfolder-cwd case for `verified-before-stop`; member-shaped eval seams; design section 7 Decision line. Risk high | `node --test tests/test-frozen.test.mjs tests/spec-frozen.test.mjs tests/verified-before-stop.test.mjs tests/evals.test.mjs` → passes with the member-shaped cases |
| 03 | crew.mjs spawn with detection and fallback | 01 | A cmux lead spawns a member through crew.sh with the fixed flags and `member` in state; every failed condition answers `transport: agent` with a reason; CLAUDE.md Commands line | `node --test tests/crew.test.mjs` → passes its spawn and fallback cases against a fake crew.sh |
| 04 | crew.mjs await and close | 03 | A member settles green, red or ended by the verify record and state, never on `done` alone; timeout exits 2; close closes and forgets by id, no-op without a member | `node --test tests/crew.test.mjs` → passes its await and close cases |
| 05 | Build dispatches members | 04 | The dispatch reference beside build; preconditions, background await, close on merge, resume rule, per-slice transport line in the Gate 4 report; design section 5 Decision line and the ADR | `node --test tests/build.test.mjs` → passes with the dispatch and the new build rules |
| 06 | Fix members from slice-review | 05 | Slice-review closes the old member, dispatches the fix member, awaits it in the foreground with the timeout; implementer step 1 reworded for both transports | `node --test tests/slice-review.test.mjs tests/agents.test.mjs` → passes with the fix dispatch rules |

## Order of work

- Frontier at start: 01, 02
- 03 after 01; 04 after 03; 05 after 04; 06 after 05. Slice 02 runs beside the chain.

## Risks

- The hook change (02) is the only risk-high slice: isolated, first on the frontier, proven by the hook tests and the eval seams; its deny reasons name paths and patterns only.
- crew.sh's interface lives in `crew.mjs` alone (03, 04), so a change in cmux-config touches one file; the fake crew.sh fixture pins the flags.
- 05 and 06 are skill text proven structurally; the first live build from a cmux lead is the real proof and confirms the two remaining hypotheses (plugin-root resolution in a member, cwd following a `cd`). It is outside this plan.
- Until 02 merges, a member in fix mode is not frozen; 06 is last in the chain, so no fix member exists before 02 lands.

## Prefactoring

- 01: the contracts and the host config before any code reads them.
