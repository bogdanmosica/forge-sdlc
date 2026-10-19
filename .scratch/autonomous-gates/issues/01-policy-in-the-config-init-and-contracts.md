# 01: autonomous-gates-01: Policy in the config, init and contracts

Type: slice
Status: ready-for-agent
Labels: ready-for-agent
Spec: `docs/efforts/autonomous-gates/spec.md` on `feat/autonomous-gates`

**What to build:** A host can name its gate policy and the plugin reads it. `## Gates` in the init template gains `- policy: attended   # or: autonomous`, and this repo's `docs/agents/forge.md` gains `- policy: attended` (the owner flips it after the merge). Init's question 4 asks `Policy: attended or autonomous?` first, leading with `attended` (the current value on a re-run), then `spec` and `max_parallel_slices` as today. `docs/contracts.md` gains the optional `stop: "open" | "flagged" | "risk-high"` on the effort record, additive, and the effort-position Names row gains `policy` and `stop`; design sections 8 and 9 follow. A host written from the template prints `gates.policy` as `attended` through `forge-config.mjs`.

**Blocked by:** None (can start immediately)

- [ ] `forge-config.mjs` prints `gates.policy` for a host written from the template and for this repo's forge.md
- [ ] Init asks the policy first in the Gates question, leading with attended, and still asks and writes `spec:`
- [ ] `docs/contracts.md` shows `stop` on the effort record and `policy`, `stop` on the effort-position row
- [ ] Design sections 8 and 9 carry the bullet and the field

## Proof

`node --test tests/config.test.mjs tests/init.test.mjs` → passes with `gates.policy` parsed from a host written from the template and the policy asked first
