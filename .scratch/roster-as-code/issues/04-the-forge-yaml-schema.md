# The forge.yaml schema

Type: grilling
Status: resolved
Labels: wayfinder:grilling
Blocked by: 01, 02, 03
Map: ../map.md

## Question

The exact shape of `docs/agents/forge.yaml`: top-level keys (a `version`, `roles`, `slots`, `enforce`), how a role entry names its agent, model and effort, how a slot entry names its skill or `disabled`, how a host-local agent is referenced, what the resolver prints, and how the shape stays open to later workflow and measurement layers. Bounded by the YAML subset (YAML without a dependency), the swap mechanism (Rewriting a call's target) and the slot table (Inventory of roles and skill slots).

## Answer

Resolved 2026-11-22 by grilling the owner, seven questions, every recommendation accepted.

1. **Mechanism (revisits the Destination's resolver decision).** Roles are swapped by the run pane mod at `agent.spawn` (`subagentType`), which also applies model and effort; leads and `MEMBERS.md` are unchanged. Skill slots resolve through `bin/roster.mjs <slot> --project <host>`, printing the skill or `disabled`; each slot's call site reads "call the skill the roster prints; skip on `disabled`". The live check that a type swap passes auto mode is the first slice's proof.
2. **Shape.**
   ```yaml
   version: 1
   enforce: false
   roles:
     reviewer:
       agent: my-plugin:reviewer     # as the Agent tool names it
       model: sonnet
       effort: medium
   slots:
     implementer.tdd: other-plugin:tdd
     domain-modeling: disabled
     policy: [writing-for-agents]
   ```
   Every key optional; role entry `agent`/`model`/`effort`; slot entry a skill name or `disabled`, `policy` a list. Host-local agents by Agent-tool type name, not path. No list-of-maps (settles the parser's open hypothesis).
3. **Slots.** `implementer.tdd`, `prototyper.prototype`, `spec-writer.codebase-design`, `grilling`, `domain-modeling`, `policy`. Disabling a required slot (`implementer.tdd`, `prototyper.prototype`, `grilling`) is a reported error and the default applies. Upstream procedures read by file are not slots.
4. **Versioning.** `version: 1` required when the file exists; an unknown top-level key is reported and ignored.
5. **Role contract.** A per-role contract doc (inputs, report shape, evidence) beside `MEMBERS.md`; a replacement gets the forge brief unchanged; no runtime check beyond the existing hooks.
6. **Glossary.** roster and slot added; host config and policy skill redefined (done in `GLOSSARY.md` on this branch).
7. **Visibility.** `bin/roster.mjs --project <host>` alone prints the resolved roster as JSON with problems; the `/forge` help panel shows resolved agents, models and slot skills.
