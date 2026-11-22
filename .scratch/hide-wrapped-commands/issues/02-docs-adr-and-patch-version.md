# 02: hide-wrapped-commands-02: Docs, ADR and patch version

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/hide-wrapped-commands/spec.md` on `feat/hide-wrapped-commands`

**What to build:** The rule is recorded where readers look: the project CLAUDE.md's run pane paragraph gains one pointer clause (the mod hides the upstream commands the loop wraps; the list lives in the `hidden-commands` module, never copied); `docs/design.md` section 10 gains a `Decision:` line (wrapped upstream commands are hidden from the menu, never disabled) pointing at a new ADR, numbered with the next free number in `docs/adr/` at build time; `plugins/forge-sdlc` bumps a patch version.

**Blocked by:** hide-wrapped-commands-01

- [ ] CLAUDE.md points at the `hidden-commands` module without listing the seven names
- [ ] design section 10 has the `Decision:` line and the new ADR exists
- [ ] plugin.json carries the patch bump; validate, typecheck and every test pass

## Proof

```sh
npm run check && grep -q hidden-commands CLAUDE.md
```

exits 0: validate, typecheck and every test green, and CLAUDE.md names the module

## Comments
