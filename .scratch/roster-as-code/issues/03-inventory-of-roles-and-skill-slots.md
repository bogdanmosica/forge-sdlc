# Inventory of roles and skill slots

Type: task
Status: resolved
Labels: wayfinder:task
Blocked by: none
Map: ../map.md

## Question

List every call site in `plugins/forge-sdlc/skills/**` and `plugins/forge-sdlc/agents/*.md` that names an agent type (`forge-sdlc:<role>`, `Explore`, ...) or a skill (`mattpocock-skills:<x>`, policy skills from forge.md), with the stage and role it belongs to. Group them into proposed slot names (e.g. `implementer.tdd`, `wayfinder.grilling`) and propose for each whether it is required or optional, with the reason. The table is the input to The forge.yaml schema.

## Answer

Resolved 2026-11-22 by the lead (AFK), from a grep of `plugins/forge-sdlc/skills/**` and `agents/*.md` on `main` at 6f03e0e.

### Roles: member calls (`subagent_type`)

| Role | Call sites | Count |
| --- | --- | --- |
| `researcher` | wayfinder SKILL.md:54 (research tickets, background), build SKILL.md:26 (exploration, foreground) | 2 |
| `prototyper` | wayfinder SKILL.md:55 (worktree isolation) | 1 |
| `spec-writer` | spec SKILL.md:22 | 1 |
| `implementer` | build SKILL.md step 4 (via MEMBERS.md, background), slice-review SKILL.md:56 (fix) | 2 |
| `verifier` | build SKILL.md:29, slice-review SKILL.md:57 | 2 |
| `reviewer` | slice-review SKILL.md:26 (three axes in parallel) | 1 |
| `merger` | build SKILL.md:30 | 1 |

All seven go through MEMBERS.md (name, wait, end), which is the natural single place to resolve a role. A swapped agent receives a brief written for the forge role (pointers, report shape, the Stop hook's verify record for the implementer): a replacement must honour the role's contract; the schema should say so per role.

### Skill slots: Skill-tool calls

| Proposed slot | Call site | Proposal | Why |
| --- | --- | --- | --- |
| `implementer.tdd` | agents/implementer.md:17 (`mattpocock-skills:tdd`) | required | the build's test-first guarantee and the test-frozen fix mode rest on it |
| `prototyper.prototype` | agents/prototyper.md:20 (`mattpocock-skills:prototype`) | required | the ticket's only method |
| `spec-writer.codebase-design` | agents/spec-writer.md:15 | optional | vocabulary aid; the spec still has its template |
| `researcher.research` | agents/researcher.md:9 (does `mattpocock-skills:research`'s job inline, not a Skill call) | required, not a Skill call | swapping means swapping the researcher role instead |
| `grilling` (wayfinder, intent) | wayfinder SKILL.md:21,53, intent SKILL.md:18 | required | Matt's HITL rule: the human answers; a replacement must keep it |
| `domain-modeling` (wayfinder, intent) | same lines | optional | glossary/ADR upkeep; the loop runs without it |
| `policy` (spec-writer, reviewer) | forge.md `## Policy skills`, read by spec SKILL.md:28, slice-review SKILL.md:20,32 | optional list | already host-configured; moving it into the YAML makes forge.md's section the deprecated path, like `## Routing` |

### Not slots: procedures read by file

`to-spec` (spec), `to-tickets` (plan), `implement-spec` (build), `wayfinder` (this skill), `pr` (build), `setup-matt-pocock-skills` (init) are read by file through `bin/skill-path.mjs`, and the frame depends on their headings (`UPSTREAM.lock`). Swapping one swaps the frame's contract, which is the workflow layer, out of scope. Proposal: not slots in v1; the schema leaves room for a later `procedures:` key. The merger reads `skills/slice-review/SKILL.md` by file: plugin-internal, not a slot.

### Built-ins

No call site names `Explore` or `general-purpose`; only forge roles are dispatched. Relevant to Enforcement scope: a host's own Explore calls are not forge member calls.
