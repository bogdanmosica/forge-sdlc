# 03: autonomous-gates-03: Gate policy reference and wayfinder's one run

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/autonomous-gates/spec.md` on `feat/autonomous-gates`

**What to build:** Under `policy: autonomous`, one wayfinder run carries an effort from the end of charting to the first stop or Gate 4. A short gate policy reference beside the wayfinder skill is the single source for the stop rule (a gate passes by policy when its artifact has no `open:` line, the spec has no flagged concern other than `- none`, and the effort is `risk: normal`; Gate 4 always stops; under attended every gate stops as today with Gate 2's `spec:` rule), the closed set of stop reasons `open`, `flagged`, `risk-high` (first in that order written, all named in the report), the report line `Gate <n> passed: policy autonomous, nothing open`, and the state write (`stop: <reason>` beside `gate`; every other stage write drops `stop`; Gate 4 writes none). Wayfinder step 1 reads the policy with the branch and the risk globs; step 7 prints the Gate 1 report and, when the policy passed it, continues as Resume step 3 with `spec` as next; on a stop it writes `stop` and reports the reasons, `risk-high` saying the effort runs attended from here; Resume step 3 continues past every `Gate <n> passed` to the first stop or Gate 4, each next stage still read by file when reached; the description gains one clause and the skill stays user-invoked. ADR 0018 "Gates pass by policy" is written and ADR 0006's status becomes `superseded by 0018` with its text kept; design sections 3, 4, 5 (with the Decision line) and 13 item 6 follow; the README's loop table and one paragraph.

**Blocked by:** 02 (effort-state and status print the policy and the stop)

- [ ] The reference exists beside wayfinder and names the four stops, the three reasons, the report line and the state write; wayfinder links it at step 7 and Resume
- [ ] Wayfinder continues on `Gate <n> passed` to the first stop or Gate 4 and reads each next stage by file
- [ ] ADR 0018 exists, ADR 0006 reads superseded, design section 5 points to 0018
- [ ] Every changed numbered step ends on a Done line; every relative link resolves

## Proof

`node --test tests/wayfinder.test.mjs` → passes with the reference linked and the continuation rule

## Assumptions

- recommended: the reference is `plugins/forge-sdlc/skills/wayfinder/GATE-POLICY.md`, linked as `[gate policy](GATE-POLICY.md)`, and names ADR 0018 nowhere by link, since a plugin file's link to `docs/adr/` would not resolve in an installed plugin (source: spec "One short reference file, beside the wayfinder skill")
- recommended: `stop` is written only under `autonomous`; an attended stop writes none, and every other stage write drops it (source: spec Assumptions "under `autonomous`, the run's stop is written to the effort's state")
- recommended: wayfinder step 7 is renamed `## 7. Gate 1`, since under `autonomous` it no longer always stops (source: spec "Step 7, under `autonomous` with a policy-passed Gate 1 ... continue as Resume step 3")
- recommended: the ADR, design and README checks live in `tests/wayfinder.test.mjs`, the slice's proof file (source: plan row 03 proof)
- recommended: the carried nits of review 01 are taken here: ADR 0018 covers design sections 8 and 9 (linked from both), section 8 says "ignored", and init item 4 names `attended` by the glossary instead of "today's loop" (source: .forge/review/autonomous-gates-01.md)

## Comments

clean. Review record: .forge/review/autonomous-gates-03.md. Merged as 5438d91.
