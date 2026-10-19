# 07: cmux-members-07: Members reference and the build stage

Type: slice
Status: ready-for-agent
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
