# Enforcement scope

Type: grilling
Status: resolved
Labels: wayfinder:grilling
Blocked by: 02, 04
Map: ../map.md

## Question

Under `enforce: true`, which calls does the hook deny: only member calls a forge-sdlc stage makes, or every Agent and Skill call in the host (built-ins like `Explore`, `general-purpose`, unrelated skills)? Does it apply outside an effort, to the lead and to members alike, and what does the deny reason say (role, file, what to do instead, never the matched value)? What happens when the roster itself is invalid under enforcement: fail open or closed?

## Answer

Resolved 2026-11-22 by grilling the owner, six questions, every recommendation accepted.

1. **Outside the roster.** Under `enforce: true`, an Agent call passes when its type is a role's default (`forge-sdlc:<role>`, swapped later by the mod), a role's resolved `agent`, or listed in `allow.agents`; a Skill call passes when it is a slot's resolved skill, a `policy` entry, a `forge-sdlc:*` skill, or listed in `allow.skills`. Everything else is denied, built-ins included unless listed. Adds `allow: { agents: [...], skills: [...] }` to the schema.
2. **Where.** The whole host session, lead and members alike, in or out of an effort.
3. **Reason.** `Agent call outside the roster (docs/agents/forge.yaml, enforce: true): fill a role with it or list it under allow.agents, or use a roster agent.`; the Skill form names slots and `allow.skills`. Never quotes the matched value.
4. **Broken roster.** Bad entries skipped one by one; `enforce: true` applies whenever that key parses (fail closed); a file too broken to read `enforce` is not enforced and the band warns (fail open).
5. **No bypass.** Turning enforcement off is a reviewed edit of `forge.yaml`; a managed-settings lock is out of scope.
6. **Mechanism.** PreToolUse command hook `hooks/scripts/roster-guard.mjs`, matcher `Agent|Skill`, on `lib.mjs`, with a guardrails eval case. Hiding non-roster agents through the mod's `agent.offer` stays fog.
