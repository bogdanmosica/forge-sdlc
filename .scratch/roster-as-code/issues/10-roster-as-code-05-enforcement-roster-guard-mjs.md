# 10: roster-as-code-05: Enforcement: roster-guard.mjs

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/roster-as-code/spec.md` on `feat/roster-as-code`

**What to build:** A PreToolUse command hook `roster-guard.mjs`, matcher `Agent|Skill`, on `lib.mjs` `run` and `deny`: no decision without forge.yaml or with enforce not on; under enforcement an Agent call passes for a role default, a roster agent or `allow.agents` (no type reads as `general-purpose`), a Skill call for a slot skill, a policy entry, a `forge-sdlc:*` skill or `allow.skills`; everything else denied for lead and members alike with the fixed reasons, never quoting the value; fail closed when `enforce: true` parses, open when unreadable; a decision for malformed payloads. Two guardrails eval cases (Agent deny, Skill deny).

**Blocked by:** roster-as-code-02

- [ ] no decision without the file or with enforce off
- [ ] each pass rule and each deny
- [ ] bare and qualified matching
- [ ] fail closed and fail open
- [ ] reason never contains the matched value
- [ ] two eval cases run by tests/evals.test.mjs

## Proof

```sh
node --test tests/roster-guard.test.mjs tests/evals.test.mjs
```

passes: unit cases and the two new guardrails eval cases green

## Comments
