---
effort: roster-as-code
stage: map
status: draft
risk: high
updated: 2026-11-22
---

# Roster as code: forge-sdlc agents and skills from a YAML file

## Destination

### Problem

Which agent fills each forge-sdlc role, which skill each stage calls, and with what model and effort, is fixed in the plugin: the agents' frontmatter, skill names hard-coded in `skills/*/SKILL.md` and `agents/*.md`, and only model and effort overridable through `## Routing` in `docs/agents/forge.md`. A host cannot swap its own implementer or reviewer in, try another TDD skill, or drop an optional skill to see whether the loop does better without it, and a platform owner cannot hand teams a standard roster and hold them to it. Warp's "factories as code" talk (https://www.youtube.com/watch?v=0LeT996Hz3E) argues the factory's agents, skills and models belong in a declarative file, so the setup can be branched, rolled back, measured and later improved by agents through PRs; this effort lays the first layer of that, the roster.

### Outcome

A host may commit `docs/agents/forge.yaml`, the **roster**: per role (`researcher`, `prototyper`, `spec-writer`, `implementer`, `verifier`, `reviewer`, `merger`) the agent definition that fills it and its model and effort; per skill slot (the implementer's `tdd`, wayfinder's `grilling`, the policy skills, ...) the skill that fills it, or `disabled` where the slot is optional. Entries are references to installed definitions only (`plugin:agent`, `plugin:skill`, a host's `.claude/agents/<x>.md`), never inline prompts. A lead resolves each member call and skill call through `bin/roster.mjs <role|slot> --project <host>`; the run pane mod applies model and effort from the YAML as it applies `## Routing` today. With `enforce: true`, a PreToolUse hook denies an Agent or Skill call outside the roster.

Observable: on this repo, a `forge.yaml` naming another agent for `reviewer` and `disabled` for an optional slot makes the next build dispatch that agent and skip that skill, the band shows `⇄ routed`; with `enforce: true` a call to an agent outside the roster is denied with a reason naming the role and the file; without `forge.yaml` nothing changes.

### Users

The owner of a host who tunes its crew (this repo, personal hosts). A platform owner who hands teams a standard, enforced roster (through the prior-sdlc port). The skills and agents whose call sites learn to resolve through the roster.

### Constraints

- No `forge.yaml` is exactly today's behaviour: the agents' frontmatter and the hard-coded skills are the defaults.
- References only; the YAML selects and configures definitions, never holds a prompt.
- Required slots (e.g. `tdd`) can be swapped, never disabled; adding roles or stages is not possible.
- An invalid entry is ignored on its own and reported in the band, as `## Routing` does today.
- `forge.yaml` wins over forge.md `## Routing`, which is still read with a deprecation toast for one minor version; `## Crew` stays in forge.md.
- Matt's skills stay unmodified; the repo keeps zero npm dependencies unless a ticket decides otherwise.
- Enforcement is opt-in (`enforce: true`) and lives in a hook under `plugins/forge-sdlc/hooks/**`, a `risk.high` path.
- A new hosts-configure-here file changes a convention: `Decision:` line in `docs/design.md` and an ADR.
- One schema, defined here; prior-sdlc ports it as its own effort.

### Open questions

- How a zero-dependency plugin parses YAML (ticket: YAML without a dependency).
- Whether a hook or the mod can rewrite an Agent or Skill call's target, which would make the swap transparent (ticket: Rewriting a call's target).
- The exact schema, slot names and which slots are optional (tickets: Inventory of roles and skill slots; The forge.yaml schema).
- What "outside the roster" means for enforcement (ticket: Enforcement scope).

## Notes

Engineering, in this plugin. Sessions read `docs/design.md`, `plugins/forge-sdlc/hooks/ROUTING.md`, `plugins/forge-sdlc/skills/build/MEMBERS.md`, `GLOSSARY.md` and `docs/adr/`. Skills to consult: `mattpocock-skills:writing-for-agents` for every skill edit, `mattpocock-skills:codebase-design` for the resolver's interface. Standing preference: the roster is the first layer of a factory-as-code; keep its shape open to later workflow and measurement layers without building them.

## Decisions so far

- Destination settled by grilling on 2026-11-22, twelve questions, every recommendation accepted:
  - Scope is the roster only (agents per role, skills per slot, model and effort); workflow and measurement are later efforts.
  - The file is `docs/agents/forge.yaml`, beside forge.md, absorbing `## Routing`; `## Crew` stays.
  - References only, no inline prompts.
  - forge-sdlc first; prior-sdlc ports the same schema as a follow-on effort in its own repository.
  - Configuration by default, governance opt-in with `enforce: true`.
  - Roles: replace and model/effort. Slots: replace, or disable when optional.
  - Swap mechanism: `bin/roster.mjs` resolver run by the lead per call, the mod for model/effort (revised by The forge.yaml schema: roles swap in the mod).
  - Bad entries ignored one by one and reported in the band; no file, no change.
  - Enforcement accepted at `risk: high`, so the effort runs attended from Gate 1.
- [Inventory of roles and skill slots](../../../.scratch/roster-as-code/issues/03-inventory-of-roles-and-skill-slots.md): seven roles, all dispatched through MEMBERS.md; six proposed skill slots (required: `implementer.tdd`, `prototyper.prototype`, `grilling`; optional: `spec-writer.codebase-design`, `domain-modeling`, `policy`); the upstream procedures read by file are not slots in v1.
- [YAML without a dependency](../../../.scratch/roster-as-code/issues/01-yaml-without-a-dependency.md): a strict-subset parser in one pure no-import `.mjs` under `hooks/`, shared by `lib.mjs` and the mod, errors located and per entry; no vendored parser.
- [Rewriting a call's target](../../../.scratch/roster-as-code/issues/02-rewriting-a-calls-target.md): roles can be swapped transparently by the mod at `agent.spawn` (not PreToolUse, which auto mode refuses); skills have no documented transparent swap; a PreToolUse hook can deny Agent/Skill calls and tell lead from member.
- [The forge.yaml schema](../../../.scratch/roster-as-code/issues/04-the-forge-yaml-schema.md): roles swapped by the mod at `agent.spawn`, slots through `bin/roster.mjs`; `version: 1`, `enforce`, `roles.<role>.{agent,model,effort}`, `slots.<slot>: <skill>|disabled`, `policy` a list; six slots, three required; unknown keys reported; a role-contract doc; roster and slot in the glossary.
- [Enforcement scope](../../../.scratch/roster-as-code/issues/05-enforcement-scope.md): deny by default under `enforce: true`, everything in the host, lead and members; passes role defaults, roster entries, `forge-sdlc:*` skills and a new `allow.{agents,skills}`; fail closed when `enforce` parses, open when it cannot; no bypass; PreToolUse `roster-guard.mjs`.

## Not yet specified

none: the way is clear. Left to the spec: the wording of each slot's call site, the eval cases and deprecation tests, and the prior-sdlc port's hand-over.

## Out of scope

- The workflow as code: stages, order, gates and triggers declared in YAML.
- Measurement: online evals over runs, benchmarks, A/B of rosters, self-improvement PRs against the YAML.
- Inline agent or skill definitions in the YAML.
- Building the prior-sdlc side in this effort.
- Adding new roles or stages.
- Hiding non-roster agents from the model's listing through the mod's `agent.offer` (a later nicety).
- A managed-settings lock on the roster, or any environment bypass of enforcement.
