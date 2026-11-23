# 25. The roster in forge.yaml

Status: accepted, 2026-11-22; amends the convention "Hosts configure the plugin in `docs/agents/forge.md` only" (CLAUDE.md), which now reads forge.md plus the optional roster

## Context

A host could not choose which agent fills a role of the loop or which skill a stage calls. Each of the seven roles was fixed by its agent file's frontmatter, each of the six skill call sites was hard-coded in the skills' and agents' text, and only model and effort could move, through forge.md's `## Routing`. An owner could not swap in their own reviewer, try another TDD skill, or drop an optional skill to see whether the loop does better without it; a platform owner could not hand teams a standard set of agents and skills and hold them to it.

forge.md is one `- key: value` bullet per line under a `## Section`. A role needs three keys (agent, model, effort), the policy skills are a list, and enforcement needs an allow list per tool: forge.md would carry them only as `<role>.<key>` bullets and comma-joined values, the shape `## Routing` already strains. The repository keeps zero npm dependencies, so a full YAML library was not an option either.

## Decision

- A host may commit `docs/agents/forge.yaml`, the **roster**, beside forge.md: `version: 1`, `enforce`, `roles.<role>` (`agent`, `model`, `effort`), `slots.<slot>` (a skill, or `disabled` for an optional slot), `slots.policy` (a list) and `allow` (`agents`, `skills`). Without the file the loop behaves exactly as before.
- One pure, no-import reader, `plugins/forge-sdlc/hooks/roster.mjs`, parses a strict YAML subset (2-space maps, scalar lists, scalars, comments; anchors, tags, block scalars and the rest rejected with the line) and resolves the roster over the defaults. The hooks, the bin scripts, the guard, the run pane mod and the `/forge` panel all read through it, so there is one reading and no mirror.
- **Roles** are swapped by the run pane mod at `agent.spawn`, where it already applied `## Routing`: a plain spawn of `forge-sdlc:<role>` becomes the roster's agent, when the session's `agent.offer` events offered that type, and its brief gains one `role contract:` line pointing at `skills/build/ROLES.md#<role>`. The leads and `MEMBERS.md` keep calling `forge-sdlc:<role>`. A rewrite at spawn, not at PreToolUse or `tool.call`, because a changed call there lands after auto mode reviewed it and is refused.
- **Slots** resolve explicitly: each call site runs `bin/roster.mjs <slot> --project <host>`, calls the skill it prints and skips the call on `disabled`. The rule is written once, in `ROLES.md` `## Slots`. A required slot (`implementer.tdd`, `prototyper.prototype`, `grilling`) cannot be disabled.
- **Enforcement** is opt-in: with `enforce: true` the PreToolUse hook `roster-guard` denies every Agent or Skill call the roster does not account for, the lead's and the members' alike. Only the literal `true` enforces; a file too broken to read `enforce` is not enforced and the band says so. There is no environment or settings bypass.
- forge.yaml wins over forge.md's `## Routing` key by key, and `slots.policy` replaces `## Policy skills` whole. Both sections are still read for one minor version, each with a deprecation line naming the key to move; `init` writes the policy skills to `slots.policy` and no longer writes `## Policy skills`. `## Crew`, `## Mark` and every other section stay in forge.md.

## Consequences

- A host's crew setup is a reviewed, branchable file: swapping the reviewer, re-routing a model or disabling `domain-modeling` is one diff to forge.yaml.
- A swapped-in agent runs its own definition with the forge brief; the worktree, the proof, the verify record and the Stop gate still hold it, and ADR 0011's write scopes become its own to honour.
- `## Routing` bullets for types that are no role (`model.Explore`) have no roster equivalent and stop working when the section is removed in 0.9.0.
- The guard sees Agent and Skill tool calls only: a slash command the human types, and the upstream procedures read by file, are outside it. Like every hook here it is a reminder backed by review, not a sandbox.
- The schema leaves room for later top-level keys (procedures, workflow, measurement); until a later version defines one, it is reported as unknown and ignored.
