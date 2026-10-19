# 07: cmux-members-07: Members reference and the build stage

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** From a teams lead, `/forge-sdlc:build` opens one named pane per agent it starts and ends each implementer once its slice is settled; from a plain lead it runs as before with names in the report. A members reference beside the build skill defines the member call once: run `crew-name.mjs <role>` (`--slice` for an implementer) before the Agent call and pass the line as `name`; after an implementer's call write the id the Agent result names as the slice's `agent`; the wait is "the member's report arrives" (the task notification or foreground return under a plain lead, the teammate's `idle_notification` mailbox message under a teams lead; the verify record stays the evidence); under a teams lead the lead ends a teammate with the agent-teams shutdown request, an implementer after its slice merges or goes red, any other member once the lead has acted on its report. Build's researcher, implementers, verifier and merger become member calls with their roles, step 4 records `agent`, the lead ends the implementer after the merger reports, the Gate 4 report adds `<slug>-<nn>: <member>` per slice, and "one foreground Agent call" becomes "one member call". The merger agent's description drops "one foreground call per slice" and its merged and red steps clear the slice's `agent`. Design section 5 gains the member call and a Decision line pointing to the new ADR "Agents as named members"; section 6 notes every agent runs as a member; sections 9 and 11 follow; the README gains the line on a lead launched with agent teams enabled and the hooks table note.

**Blocked by:** 05 (crew-name.mjs picks and records the next name), 06 (Stop gate finds a subagent's slice by agent id)

- [ ] The members reference exists beside build and names `crew-name.mjs`, `name`, the `agent` write, the report wait and the shutdown request; build links it at each Agent call with the role
- [ ] Build has the Gate 4 member line and the shutdown after merged or red; the merger clears `agent`; the implementer still says "first Bash call is `cd <worktree>`"
- [ ] The skills say neither "teammate" nor "task notification" outside the reference
- [ ] The ADR exists under docs/adr, design section 5 points to it, and every linked file exists

## Proof

`node --test tests/build.test.mjs tests/agents.test.mjs` → passes with the member calls and the reference

## Comments

red 2026-10-19: blocked by a red slice. Slice 05 (crew-name.mjs) ended red after two fix rounds with one Important finding left (a missing test for the `updatedAt` write, see `.forge/review/cmux-members-05.md`); this slice was not started. The next build run retries 05 first.

build 2026-10-19 (blocker 05 merged; the red note above is stale):
- recommended: the members reference is `skills/build/MEMBERS.md`, so slice 08 links it as `../build/MEMBERS.md` (source: spec, "The member call, written once": "A members reference beside the build skill")
- recommended: build's verifier and merger calls say "foreground under a plain lead" rather than dropping the word, since the reference leaves foreground or background to the skill; "one foreground Agent call" is gone (source: spec, "The member call, written once", third bullet; "Build skill", last sentence)
- recommended: the reference names the shutdown as "a `SendMessage` shutdown request addressed to the member's name" and spells no fields, which the docs leave undocumented (source: spec, "The member call, written once", fourth bullet; notes, agent-teams section 4)
- recommended: the merger clears `agent` by deleting the key, as an absent field reads as none (source: spec, "State schema": "an absent field reads as none")
- recommended: the design and ADR checks live in `tests/build.test.mjs`, the proof's file, and design section 11 gains `MEMBERS.md`, `crew.json` and `crew-name.mjs` (source: spec, "Design record": "section 11 the presets file and the script")

## Answer
merged 9579953 into feat/cmux-members. Review record: .forge/review/cmux-members-07.md (clean after 2 fix rounds).
