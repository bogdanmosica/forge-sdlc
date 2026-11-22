# 11: roster-as-code-06: ROLES.md and the self-resolving slot call sites

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** A new `ROLES.md` beside `MEMBERS.md`: each role's inputs, report shape, evidence and holding hooks, and the `## Slots` rule (run `bin/roster.mjs <slot> --project <host>`, call what it prints, skip on `disabled`). The implementer (`implementer.tdd`), the prototyper (`prototyper.prototype`), wayfinder and intent (`grilling`, `domain-modeling`) each get a one-line call site naming the slot, its default skill and the command.

**Blocked by:** roster-as-code-02

- [ ] ROLES.md holds the seven role contracts and the slot rule
- [ ] each of the four call sites names its slot, default skill and command
- [ ] existing text tests on the default skill names keep holding

## Proof

```sh
node --test tests/roster-slots.test.mjs tests/agents.test.mjs tests/wayfinder.test.mjs tests/intent.test.mjs
```

passes: the slot call-site checks and the existing text tests green

## Comments
