# 13: roster-as-code-08: /forge panel shows the roster

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** The `/forge` help panel shows each role's resolved agent when swapped and its resolved model and effort, and a slots table with each slot's skill or `disabled`, read through the shared reader; without forge.yaml the panel is as today.

**Blocked by:** roster-as-code-01

- [ ] swapped agents, models and efforts show
- [ ] the slots table lists every slot
- [ ] without forge.yaml the panel is unchanged
- [ ] tests/forge-help.test.mjs still holds the tables to the plugin's skills

## Proof

```sh
test -f plugins/forge-sdlc/hooks/forge.roster.test.tsx && claude plugin test plugins/forge-sdlc && node --test tests/forge-help.test.mjs
```

passes: the panel's roster tests and the help-table test green

## Comments
