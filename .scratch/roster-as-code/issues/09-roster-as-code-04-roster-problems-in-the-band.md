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

- recommended: the roster and `## Routing` are read at each five-second refresh as well as at each spawn, so deprecation lines, bad entries and an unreadable `enforce` reach the band without waiting for a spawn and leave it once fixed (source: spec, user story 25, "reported once as a toast and in the band while it stays bad"; Run pane mod, band and toasts, "through the existing say-once path")
- recommended: the unoffered swap target that slice 03 reported on the `routing` note moves to the `roster` note, reported from the first spawn on (before any spawn no agent listing has offered anything, so a refresh would report every swapped role falsely) and kept while the role still names a type not offered (source: spec, "Otherwise the default agent spawns and the entry is reported as naming no offered agent"; slice 03's assumption "until slice 04 adds the `roster` band section")
- recommended: an invalid `## Routing` value stays on the `routing` note alone (`routing ignored: ...`); the roster note drops roster.mjs's matching `## Routing: ... ; ignored` line so the band shows it once, beside the key's deprecation line (source: spec, Run pane mod, band and toasts, "a new `roster` note section beside `routing`"; "Each problem is one band-ready line")
- recommended: the band draws the roster note right after the routing note (source: spec, "beside `routing`, `crew`, `mark` and `worktrees`")
