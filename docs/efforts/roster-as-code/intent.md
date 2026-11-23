---
effort: roster-as-code
stage: intent
status: accepted
risk: high
updated: 2026-11-22
---

# Intent: Roster as code: forge-sdlc agents and skills from a YAML file

Map: [map.md](map.md)

## Problem

Which agent fills each forge-sdlc role, which skill each stage calls, and with what model and effort, is fixed in the plugin: the agents' frontmatter, skill names hard-coded in `skills/*/SKILL.md` and `agents/*.md`, and only model and effort overridable through `## Routing` in `docs/agents/forge.md`. A host cannot swap its own implementer or reviewer in, try another TDD skill, or drop an optional skill to see whether the loop does better without it, and a platform owner cannot hand teams a standard roster and hold them to it. Warp's "factories as code" talk (https://www.youtube.com/watch?v=0LeT996Hz3E) argues the factory's agents, skills and models belong in a declarative file, so the setup can be branched, rolled back, measured and later improved by agents through PRs. This effort lays the first layer of that: the roster. Evidence: the inventory found seven roles and six skill call sites, every one of them fixed in plugin text.

## Outcome

A host may commit `docs/agents/forge.yaml`, the **roster**:

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
allow:
  agents: [Explore]
  skills: []
```

- **Roles** (`researcher`, `prototyper`, `spec-writer`, `implementer`, `verifier`, `reviewer`, `merger`): the run pane mod swaps the agent at `agent.spawn` and applies model and effort there, as it applies `## Routing` today; leads and `MEMBERS.md` are unchanged.
- **Slots** (`implementer.tdd`, `prototyper.prototype`, `grilling` required; `spec-writer.codebase-design`, `domain-modeling`, `policy` optional): each call site calls the skill `bin/roster.mjs <slot> --project <host>` prints, and skips on `disabled`.
- **Enforcement**: with `enforce: true`, the PreToolUse hook `roster-guard.mjs` denies every Agent or Skill call in the host that is not a role default, a roster entry, a `forge-sdlc:*` skill or under `allow`.
- `bin/roster.mjs --project <host>` prints the resolved roster as JSON with its problems; the `/forge` help panel shows resolved agents, models and slot skills; bad entries are skipped one by one and reported in the band.

Observable: on this repo, a `forge.yaml` naming another agent for `reviewer` and `disabled` for `domain-modeling` makes the next slice-review dispatch that agent (band `⇄ routed`) and the next grilling skip domain modeling; with `enforce: true` an `Explore` call not under `allow.agents` is denied with the reason naming `docs/agents/forge.yaml`; without `forge.yaml` every test and eval passes unchanged.

## Users

The owner of a host who tunes its crew (this repo, personal hosts). A platform owner who hands teams a standard, enforced roster, through the prior-sdlc port. The skills and agents whose slot call sites learn to resolve through the roster, and the run pane mod, which learns to swap agents.

## Constraints

- No `forge.yaml` is exactly today's behaviour: agent frontmatter and the hard-coded skills are the defaults.
- References only: entries name installed agents and skills, never hold a prompt; a host-local agent is named by its Agent-tool type.
- Required slots can be swapped, never disabled; roles and stages cannot be added.
- Zero npm dependencies: a strict-subset YAML parser, one pure no-import `.mjs` under `plugins/forge-sdlc/hooks/`, shared by `lib.mjs` and the mod.
- Agent swaps happen at the mod's `agent.spawn`, never by rewriting a tool call, which auto mode refuses.
- `forge.yaml` wins over forge.md `## Routing` and `## Policy skills`, still read with a deprecation toast for one minor version; `## Crew` stays in forge.md.
- Enforcement is opt-in, has no bypass but editing the file, fails closed when `enforce` parses and open when it cannot; its reason never quotes the matched value.
- Touches `plugins/forge-sdlc/hooks/**` and `.claude-plugin/**`: `risk: high`, attended from Gate 1.
- Matt's skills unmodified; upstream procedures read by file are not slots.
- One schema, defined here; prior-sdlc ports it as its own effort.

## Open questions

none

## Decisions so far

- Destination, grilled 2026-11-22: the roster only; `docs/agents/forge.yaml` beside forge.md; references only; forge-sdlc first, prior-sdlc later; enforcement opt-in; roles replace plus model/effort, slots replace or disable; bad entries skipped and reported; `risk: high` accepted.
- [Inventory of roles and skill slots](../../../.scratch/roster-as-code/issues/03-inventory-of-roles-and-skill-slots.md): seven roles through `MEMBERS.md`; six slots, three required; procedures read by file are not slots.
- [YAML without a dependency](../../../.scratch/roster-as-code/issues/01-yaml-without-a-dependency.md): strict-subset parser in one shared pure file; no vendored parser.
- [Rewriting a call's target](../../../.scratch/roster-as-code/issues/02-rewriting-a-calls-target.md): agents swap at the mod's `agent.spawn`; skills have no transparent swap; a PreToolUse hook can deny and tell lead from member.
- [The forge.yaml schema](../../../.scratch/roster-as-code/issues/04-the-forge-yaml-schema.md): roles in the mod, slots through `bin/roster.mjs`; the shape above; `version: 1`, unknown keys reported; a role-contract doc; roster and slot in the glossary.
- [Enforcement scope](../../../.scratch/roster-as-code/issues/05-enforcement-scope.md): deny by default host-wide, lead and members; `allow.{agents,skills}`; fail closed/open on parse; no bypass; `roster-guard.mjs`.

## Out of scope

- The workflow as code (stages, order, gates, triggers in YAML): a later layer.
- Measurement (online evals, benchmarks, roster A/B, self-improvement PRs): a later layer.
- Inline agent or skill definitions in the YAML.
- Building the prior-sdlc side: its own effort.
- Adding roles or stages; making upstream procedures swappable.
- Hiding non-roster agents through `agent.offer`; a managed-settings lock or environment bypass.

## Assumptions to confirm

- recommended: the first slice is a spike proving the two live hypotheses before the rest builds on them: the mod's `subagentType` rewrite at `agent.spawn` passes auto mode, and the mod bundler loads the shared `.mjs` parser from a `.ts` file (source: Rewriting a call's target; YAML without a dependency)
- recommended: whether a swapped-in implementer completes a slice from the unchanged brief is checked by hand once at Gate 4, not by an automated proof; the role-contract doc is the guard (source: Rewriting a call's target)
- recommended: `/forge-sdlc:init` writes `forge.yaml` with `version: 1` and `slots.policy` from its policy-skills question; every other roster key stays optional (source: owner at Gate 2, overturning the earlier "init does not write forge.yaml")
- recommended: forge.md `## Routing` and `## Policy skills` are removed in the minor version after this one ships; the toast names `forge.yaml` and the key to move (source: The forge.yaml schema)
- recommended: `roster-guard.mjs` prints no decision when there is no `forge.yaml` or `enforce` is not `true`, so hosts without a roster pay nothing (source: Enforcement scope)
- recommended: the ADR is 0024, "The roster in forge.yaml", with a `Decision:` line in `docs/design.md` amending the forge.md-only convention in CLAUDE.md (source: CLAUDE.md Conventions)
- recommended: the spec carries a short port section for prior-sdlc (schema, parser file, hook, mod change) and no code outside this repo (source: Destination)
- recommended: `plugins/forge-sdlc` bumps to 0.8.0, a minor, since a new host file and a new hook ship (source: CLAUDE.md)
