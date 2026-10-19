# 03: cmux-members-03: Crew theme in the contracts, config and init

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Spec: `docs/efforts/cmux-members/spec.md` on `feat/cmux-members`

**What to build:** A host can name its crew theme and the plugin reads it. `docs/contracts.md` gains the state shape's `crew: { "<role>": [...] }` per effort and `member` and `agent` per slice, plus Names rows for `crew-name.mjs` and `crew.json`; design sections 8 and 9 follow. `## Crew` with `- theme: <preset id | none | free text>` and optional `- names.<role>: ...` bullets lands in the init template (`theme: none`) and in this repo's `docs/agents/forge.md`, and `forge-config.mjs` prints it as `crew`. Init asks one new question after Policy skills, prior-sdlc's question 8: None, a preset (two pages: Warcraft, Star Trek, Star Wars, More; then Game of Thrones, Super Mario), or free text, with the free-text rule for `names.<role>` bullets. Slice 02's rationale is reworded everywhere it says a member's project dir is its worktree: design section 7's Decision line, the lib's `hostDirOf` comment, the eval host helper's comment, the README guardrails row, the two `*-member-denied` case descriptions and the two test names; the case folder names stay.

**Blocked by:** None (can start immediately)

- [ ] `forge-config.mjs` prints `crew.theme` for this repo's forge.md and for a host written from the init template, and `crew["names.<role>"]` when a bullet is present
- [ ] A new `tests/init.test.mjs` finds the Crew question in init with its five presets and the free-text rule
- [ ] `docs/contracts.md` shows `crew`, `member` and `agent` and the two Names rows
- [ ] No file says "a member's project dir is its slice worktree" any more; the reworded sentence names a session whose project dir is a slice worktree

## Proof

`node --test tests/config.test.mjs tests/init.test.mjs` → passes with `crew.theme` parsed and the Crew question with its five presets
