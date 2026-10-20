---
effort: autonomous-gates
stage: plan
status: accepted
risk: normal
updated: 2026-10-19
---

# Plan: Autonomous run after wayfinder

Spec: [spec.md](spec.md). Tickets: `.scratch/autonomous-gates/issues/01-…04-*.md`. The tracker carries the live state (claims, frontier, closed); this file is the approved breakdown.

## Slices

| nn | title | blocked by | delivers | proof |
| --- | --- | --- | --- | --- |
| 01 | Policy in the config, init and contracts | none | `policy: attended` in the template and this repo's forge.md; init asks the policy first; `stop` and the Names row in the contracts; design sections 8 and 9 | `node --test tests/config.test.mjs tests/init.test.mjs` → passes with `gates.policy` parsed from a host written from the template and the policy asked first |
| 02 | effort-state and status print the policy and the stop | 01 | `effort-state` prints `policy` and `stop`, `why` names a stop, `--list` carries both, default attended in the script; status prints them | `node --test tests/effort-state.test.mjs tests/status.test.mjs` → passes with the seven policy and stop cases |
| 03 | Gate policy reference and wayfinder's one run | 02 | The reference (stop rule, reasons, report line, state write); wayfinder step 1, step 7 and Resume continue on `Gate <n> passed` to the first stop or Gate 4; ADR 0018, ADR 0006 superseded; design sections 3, 4, 5 and 13; README | `node --test tests/wayfinder.test.mjs` → passes with the reference linked and the continuation rule |
| 04 | spec and plan pass their gates by policy | 03 | spec accepts a policy-passed Gate 1 and applies the stop rule; plan accepts a policy-passed Gate 2, answers the quiz with the drafted breakdown under autonomous, writes the Quiz block in plan.md and the PR body, reports `Gate 3 passed`; the template's Quiz section | `node --test tests/spec.test.mjs tests/plan.test.mjs` → passes with the policy rules and the Quiz block |

## Order of work

- Frontier at start: 01
- 02 after 01; 03 after 02; 04 after 03

## Risks

- No path under the risk-high globs changes: the `attended` default lives in `effort-state`, never in the hooks' shared library.
- The one-run chain (03) and the self-answered quiz (04) are skill text proven structurally; the live proof is the first `/forge-sdlc:wayfinder <idea>` on this repo with `policy: autonomous` after the merge.
- Slice 04 changes who answers Matt's quiz by frame rule; to-tickets itself stays unmodified.

## Prefactoring

- 01: the key and the state field before anything reads them.
