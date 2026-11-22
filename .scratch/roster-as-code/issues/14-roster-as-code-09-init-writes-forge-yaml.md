# 14: roster-as-code-09: Init writes forge.yaml

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** Init keeps its policy-skills question and writes the answer to `docs/agents/forge.yaml` as `version: 1` with `slots.policy` (an empty list for none), creating the file or rewriting only that key; its forge.md template drops `## Policy skills`.

**Blocked by:** roster-as-code-01, roster-as-code-07

- [ ] init writes forge.yaml with version 1 and slots.policy
- [ ] an existing forge.yaml keeps every other key
- [ ] the forge.md template has no Policy skills section

## Proof

```sh
node --test tests/roster-init.test.mjs tests/init.test.mjs
```

passes: the init roster checks and the updated init tests green

## Comments

- recommended: "init writes" is an instruction in the skill text, checked by text tests and by reading the example back through the roster reader; no script added (source: spec Init and Testing Decisions)
- recommended: a re-run leads with the current slots.policy, else the deprecated ## Policy skills bullet, and drops that section from forge.md since the template no longer has it (source: spec "rewriting only that key")
- recommended: evals/lib/host.sh still writes ## Policy skills into eval fixtures; left alone while the deprecated section is still read (source: spec deprecation)

red (Bugs and security): merged before slice 07, a host that re-ran init loses its policy skills, because spec and slice-review still read the forge.md bullets. Merge after 07 lands (add 07 as a dependency of 09 in plan.md), then re-review. Findings: .forge/review/roster-as-code-09.md

- recommended: roster-as-code-07 added as a blocker of 09 during build; 09 re-runs its merge after 07 merges, from this worktree (source: the red finding above; build step 6)
