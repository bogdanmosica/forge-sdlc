# 01: hide-wrapped-commands-01: Hide the wrapped upstream commands

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/hide-wrapped-commands/spec.md` on `feat/hide-wrapped-commands`

**What to build:** A driver's `/` typeahead and `/help` no longer list the upstream commands the loop wraps (`wayfinder`, `to-spec`, `to-tickets`, `implement-spec`, `setup-matt-pocock-skills`, `code-review`, `pr` from `mattpocock-skills`), while each still runs typed in full and through the Skill tool. A pure `hidden-commands` module in the run pane's pure parts holds the list, a matcher builder (qualified or bare name, `provider.plugin` pinned to `mattpocock-skills`) and a predicate; the run pane registers one matched `command.describe` hook per command answering `isHidden: true` with description and hint unchanged.

**Blocked by:** None (can start immediately)

- [ ] each of the seven, from `mattpocock-skills`, describes as hidden with description and hint unchanged
- [ ] `forge-sdlc:wayfinder`, `mattpocock-skills:tdd`, `mattpocock-skills:grill-me` and another provider's bare `pr` stay listed
- [ ] the list equals `UPSTREAM.lock`'s skills plus `pr`, and holds no model-invoked or unwrapped skill
- [ ] the hooks typecheck against the engine's `CommandDescribeInput` and `CommandDescribeResult`

## Proof

```sh
node --test tests/hidden-commands.test.mjs && test -f plugins/forge-sdlc/hooks/run-pane.hidden.test.tsx && claude plugin test plugins/forge-sdlc && npm run typecheck
```

passes: the node seam and the new mod seam green, every existing mod test green, the mod typechecks

## Comments
