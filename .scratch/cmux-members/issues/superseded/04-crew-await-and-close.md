# 04: cmux-members-04: crew.mjs await and close

Type: slice
Status: closed (superseded: transport reopened by ticket 07, crew.sh dropped)
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** The lead waits for a member with `crew.mjs await --slice --project [--timeout <s>]` and gets `settled: green | red | ended` with the report path. Green: the verify record is green at the worktree's HEAD and the denials file is absent. Red: the slice is `red` in state and the denials file is gone. Ended: crew.sh reports the member ended, closed or unknown while neither holds. A crew.sh `done` with none of these is still running and is polled again, so the done statuses a blocked member produces settle nothing. Timeout prints `settled: null` and exits 2. `crew.mjs close --slice --project` closes the member's tab and forgets its record by id only, writes `member: null`, and is a no-op with exit 0 on a slice without a member.

**Blocked by:** 03 (crew.mjs spawn with detection and fallback)

- [ ] `done` with no record, a stale record, or a red record with denials present keeps waiting, then settles green once a green record at HEAD appears
- [ ] Settles red on a red slice with denials gone; ended on an ended member with no green record; `settled: null` and exit 2 on timeout
- [ ] close calls crew.sh `close <id>` and `forget <id>` by id only, never done, closed or all, and writes `member: null`
- [ ] close on a slice without a member exits 0 and calls nothing

## Proof

`node --test tests/crew.test.mjs` → passes its await and close cases

## Notes from the build

- recommended: `close` closes the tab and writes `member: null` but does not `forget` the record; records are forgotten once at the end of the build, by id, for every slice that was a member. Reason: the exploration note on crew.sh (`.forge/notes/cmux-members/crew-sh-interface.md`) found that `forget <id>` while a later member is live makes the next spawn reuse that later id and overwrite its record, and parallel spawns race on the id counter. The intent's own decision (Q7) was "forget every record when the build ends"; the spec's "close forgets" is the deviation. (source: intent Decisions so far, lifecycle; crew.sh lines 262-263 per the note)
- recommended: `crew.mjs spawn` is called one slice at a time by the lead, never concurrently, so the id-counter race cannot occur inside one build (source: build skill step 4, sequential dispatch)
