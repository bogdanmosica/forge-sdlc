# 14: roster-as-code-09: Init writes forge.yaml

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** Init keeps its policy-skills question and writes the answer to `docs/agents/forge.yaml` as `version: 1` with `slots.policy` (an empty list for none), creating the file or rewriting only that key; its forge.md template drops `## Policy skills`.

**Blocked by:** roster-as-code-01

- [ ] init writes forge.yaml with version 1 and slots.policy
- [ ] an existing forge.yaml keeps every other key
- [ ] the forge.md template has no Policy skills section

## Proof

```sh
node --test tests/roster-init.test.mjs tests/init.test.mjs
```

passes: the init roster checks and the updated init tests green

## Comments
