# 01: cmux-members-01: Crew section and member field in the contracts

Type: slice
Status: withdrawn (superseded: the crew.sh plan; the contracts slice is 03 of the second plan)
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** A host's `forge.md` can carry a `## Crew` section, `mode: auto` (or crew, agent) and `script: ~/.config/cmux/scripts/crew.sh`, and the plugin reads it as `crew.mode` and `crew.script`. This repo's forge.md, the init template and init itself carry it, init deriving it without a question. The contracts gain the slice `member` field (`{ id, record }` or null) and a Names row for `crew.mjs`; design sections 8 and 9 follow. The eval scaffold's forge.md pins `mode: agent` so no eval run opens a tab.

**Blocked by:** None (can start immediately)

- [ ] `forge-config.mjs` prints `crew.mode` and `crew.script` for this repo's forge.md and for a host written from the init template
- [ ] A host with no `## Crew` section is documented in the contracts as `auto` with the default script
- [ ] `docs/contracts.md` state shape shows `member` on a slice and the Names table has `crew.mjs`
- [ ] The eval scaffold's forge.md carries `## Crew` with `mode: agent`

## Proof

`node --test tests/config.test.mjs` → passes with `crew.mode` and `crew.script` parsed from this repo's forge.md and the template
