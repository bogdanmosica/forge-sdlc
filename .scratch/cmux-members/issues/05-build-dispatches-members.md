# 05: cmux-members-05: Build dispatches members

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** The build stage opens one visible member per frontier slice when the lead is in cmux and runs as before anywhere else. The dispatch is written once in a reference file beside the build skill: write the implementer's pointer lines, every one an absolute path, to the task file under the effort's notes `members/` subfolder; call `crew.mjs spawn`; on member, await it in the background; on agent, make the Agent call with the same lines. Build gains two precondition lines (`forge.md` committed on the effort branch; the plugin enabled at user or project scope), closes a slice's member after its merger reports merged, keeps a red slice's member, awaits every building slice with a member on resume instead of respawning, and reports one transport line per slice in the Gate 4 report with `mode: crew` fallbacks as a warning first. Design section 5 gains the member transport and its Decision line; the ADR "Implementers as cmux members" is written.

**Blocked by:** 04 (crew.mjs await and close)

- [ ] The dispatch reference exists beside the build skill and build step 4 links it
- [ ] Build names `crew.mjs` spawn, await and close, the background await, the two precondition lines, the close-on-merge rule, the resume rule and the per-slice transport line
- [ ] The ADR exists under docs/adr and design section 5 points to it
- [ ] Every linked file exists

## Proof

`node --test tests/build.test.mjs` → passes with the dispatch and the new build rules
