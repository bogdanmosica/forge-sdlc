# 15: roster-as-code-10: Docs, ADR and version

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** `hooks/ROUTING.md` becomes the roster and routing reference; README roster section; ADR 0024 "The roster in forge.yaml"; a `Decision:` line in design section 8 and the agent-table note; CLAUDE.md's host-config clause names the optional forge.yaml; `plugins/forge-sdlc` bumps to 0.8.0 with the roster in its description.

**Blocked by:** roster-as-code-03, roster-as-code-04, roster-as-code-05, roster-as-code-06, roster-as-code-07, roster-as-code-08, roster-as-code-09

- [ ] ROUTING.md, README, ADR 0024, design and CLAUDE.md updated
- [ ] plugin.json reads 0.8.0
- [ ] validate, typecheck and the whole suite pass

## Proof

```sh
npm run check
```

exits 0: validate, typecheck and every test green

## Comments
