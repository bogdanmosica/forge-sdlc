# 10: roster-as-code-05: Enforcement: roster-guard.mjs

Type: slice
Status: resolved
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

- recommended: under enforcement an Agent or Skill call whose tool_input is missing, not an object, or carries a non-string or empty `subagent_type`/`skill` is denied with the fixed reason; a payload naming any other tool gets no decision (source: spec "It returns a decision for every payload, malformed ones included" and "enforcement to stay on whenever `enforce: true` parses")
- recommended: the guard reads forge.yaml from the project dir when it holds forge.md or forge.yaml, else from the host `hostDirOf` finds through git (source: spec "Hook helpers", `readRoster(hostDir)`; notes "roster-guard repeat readHostConfig(projectDir) ? projectDir : hostDirOf")
- recommended: a slot set to `disabled` accounts for no skill, so its default skill is denied under enforcement, as is a swapped-out default (source: spec "a slot's resolved skill")
- recommended: the Skill eval case calls a project-local skill (`.claude/skills/word-stats`) so the call is real without mattpocock-skills installed; its seam payload is a member's (source: spec "lead and member payloads alike")
- recommended: the README Hooks table row for roster-guard is left to row 10, Docs (source: plan row 10 "README roster section")

clean. Review record: .forge/review/roster-as-code-05.md. Merged 736667e into feat/roster-as-code.
