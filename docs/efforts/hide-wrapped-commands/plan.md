---
effort: hide-wrapped-commands
stage: plan
status: accepted
risk: high
updated: 2026-11-22
---

# Plan: Hide the upstream commands forge-sdlc wraps

Spec: [spec.md](spec.md). Tickets: `.scratch/hide-wrapped-commands/issues/`. The tracker carries the live state (claims, frontier, closed); this file is the approved breakdown.

## Slices

| nn | title | blocked by | delivers |
| --- | --- | --- | --- |
| 01 | Hide the wrapped upstream commands | none | the pure `hidden-commands` module and one matched `command.describe` hook per wrapped upstream command, so they leave the typeahead and `/help` but still run |
| 02 | Docs, ADR and patch version | 01 | the CLAUDE.md pointer clause, design section 10 `Decision:` line, a new ADR, the patch bump |

### Proofs

#### 01

```sh
node --test tests/hidden-commands.test.mjs && test -f plugins/forge-sdlc/hooks/run-pane.hidden.test.tsx && claude plugin test plugins/forge-sdlc && npm run typecheck
```

passes: the node seam and the new mod seam green, every existing mod test green, the mod typechecks

#### 02

```sh
npm run check && grep -q hidden-commands CLAUDE.md
```

exits 0: validate, typecheck and every test green, and CLAUDE.md names the module

## Order of work

- Frontier at start: 01
- 02 after 01

## Risks

- The typeahead and `/help` actually honouring `isHidden` from another plugin's hook: the stand-in host proves the wiring; the owner checks `/to-` live at Gate 4.
- ADR number collision with `roster-as-code` (0024) and `workflow-as-code`: slice 02 takes the next free number when it builds and the later merge renumbers if needed.

## Prefactoring

- none
