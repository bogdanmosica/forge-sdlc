# 09: roster-as-code-04: Roster problems in the band

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** A `roster` note section in the band beside routing, crew, mark and worktrees: each bad roster entry toasted once and kept in the band while it stays bad; deprecation toasts when `## Routing` has bullets or `## Policy skills` holds a value other than `none`, each naming `docs/agents/forge.yaml` and the key to move (and that non-role routing bullets stop with the section); a warning when `enforce` is unreadable. The state contract gains `RunPaneNotes.roster`.

**Blocked by:** roster-as-code-03

- [ ] a bad entry toasts once and stays in the band
- [ ] both deprecation toasts appear only when the section holds something
- [ ] an unreadable enforce warns

## Proof

```sh
test -f plugins/forge-sdlc/hooks/run-pane.roster-band.test.tsx && claude plugin test plugins/forge-sdlc && npm run typecheck
```

passes: the band tests green over the stand-in host

## Comments
