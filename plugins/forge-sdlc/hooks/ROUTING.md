# The roster and routing: who fills each role, on which model and effort

The roster is the host's optional `docs/agents/forge.yaml`: which agent fills each of the seven roles and with which model and effort, which skill fills each slot, and, under `enforce: true`, which Agent and Skill calls are allowed at all. One pure reader, `hooks/roster.mjs`, parses the file and resolves it over the defaults and forge.md's deprecated sections. Three consumers use it: the run pane mod (`run-pane.tsx`, its routing in `run-pane/routing.ts`) applies the roles at each `agent.spawn`, the skills ask `bin/roster.mjs <slot> --project <host>` for a slot's skill, and the `roster-guard` hook enforces the lists. Without the file, every role is `forge-sdlc:<role>` with its agent frontmatter and every slot is today's skill. Read [ROLES.md](../skills/build/ROLES.md) before filling a role with another agent: it lists what each role is given, what it reports, the evidence it leaves and the hooks that hold it.

## Shape

The file holds only references to installed agents and skills, never a prompt, a credential or an inline definition.

```yaml
version: 1                      # required when the file exists
enforce: false                  # only the literal true enforces
roles:                          # researcher, prototyper, spec-writer, implementer, verifier, reviewer, merger
  reviewer:
    agent: my-plugin:reviewer   # the Agent-tool type: plugin:agent, or a host-local agent's type
    model: sonnet               # an alias or a claude-* id
    effort: medium              # low | medium | high | xhigh | max
slots:
  implementer.tdd: other-plugin:tdd     # required: swap only
  spec-writer.codebase-design: disabled # optional: swap or disable
  policy: [writing-for-agents]          # optional list; [] or absent means none
allow:
  agents: [Explore]
  skills: []
```

- Every key is optional except `version`. The grammar is a strict YAML subset: 2-space maps, scalar lists (block or one-line flow), plain and quoted scalars, booleans, integers, null and comments. Anchors, aliases, tags, merge keys, block scalars, multi-line flow, several documents, tabs and duplicate keys are each rejected with an error naming the line.
- `roles.<role>`: the seven roles are the whole set. `agent` is the Agent-tool type that fills the role. `model` is an alias Claude Code accepts (`opus`, `sonnet`, `haiku`, `fable`, `best`, `default`, `opusplan`, `inherit`) or a full id (`claude-opus-5-5`, with or without the `[1m]` suffix); pin full ids on a third-party provider, where an alias resolves to another version. `effort` is `low`, `medium`, `high`, `xhigh` or `max`. Any one field alone is enough.
- `slots`: the six slots are the whole set. Required, swap only: `implementer.tdd` (default `mattpocock-skills:tdd`), `prototyper.prototype` (`mattpocock-skills:prototype`) and `grilling` (`mattpocock-skills:grilling`). Optional, swap or `disabled`: `spec-writer.codebase-design` (`mattpocock-skills:codebase-design`), `domain-modeling` (`mattpocock-skills:domain-modeling`), and `policy`, a list of skills (default: forge.md's deprecated `## Policy skills`, then none). The `## Slots` section of ROLES.md is the rule each call site follows.
- `allow.agents`, `allow.skills`: further names `roster-guard` lets through under `enforce: true`.
- `bin/roster.mjs <slot> --project <host>` prints the slot's skill or `disabled`, and for `policy` the names comma-separated or `none`; `bin/roster.mjs --project <host>` prints the whole resolved roster as JSON with its `problems`.

## Precedence

The agent file's frontmatter is the default and the roster overrides it; `## Routing` overrides it only where the roster leaves a key unset. Key by key, a role's `model` or `effort` in forge.yaml beats the matching `model.<role>` or `effort.<role>` bullet, and a bullet for a key the roster leaves unset still applies while the section lasts. A routed model also replaces a model the dispatching skill passed on the Agent call, so a skill's own choice yields to the host's. `slots.policy`, when present, replaces `## Policy skills` whole. The engine stays above all of them: `CLAUDE_CODE_SUBAGENT_MODEL` with `_FORCE=1`, `CLAUDE_CODE_EFFORT_LEVEL` and the `maxEffortLevel` cap still win. A fork inherits its parent and is left alone; an agent whose model takes no effort (Haiku) keeps its steps as they are.

## Deprecated

Three sections of `docs/agents/forge.md` are deprecated and still read through 0.9.x: `## Routing` (its `model.<role>` and `effort.<role>` bullets) and `## Policy skills` since 0.8.0, and `## Gates` (`policy`, `spec`, `max_parallel_slices`, moving to `workflow:`) since 0.9.0. All three are removed together in the next minor, 0.10.0, not in 0.9.0 as first announced ([ADR 0026](../../../docs/adr/0026-the-loop-declared-tuned-per-gate.md)). Each bullet left in them is a toast and a band line naming the forge.yaml key to move it to:

- `## Routing: model.implementer is deprecated; move it to roles.implementer.model in docs/agents/forge.yaml`
- `## Policy skills: skills is deprecated; move it to slots.policy in docs/agents/forge.yaml` (a value of `none` says nothing)
- `## Gates: policy is deprecated; move it to workflow.policy in docs/agents/forge.yaml`, and the same for `max_parallel_slices`
- `## Gates: spec only-on-open is deprecated; move it to workflow.gates.spec: policy in docs/agents/forge.yaml`
- `## Gates: spec always is deprecated and has no docs/agents/forge.yaml equivalent; Gate 2 follows workflow.policy`
- `## Routing: model.Explore is deprecated and has no docs/agents/forge.yaml equivalent; it stops working when ## Routing is removed`: a bullet for an agent type that is no role (`Explore`, or any other type verbatim) works only through the deprecated section.

## Invalid entries

An invalid entry is ignored on its own and the default applies for that key; the rest of the file is read. Each problem is one band line starting `roster:`, toasted once and kept in the band above the prompt while the entry stays invalid:

- a YAML subset error, naming the line (`roster: line 4: a tab: indent and separate with spaces`);
- an unknown top-level key, role, role field or slot (`roster: roles.tester is not a role (...); ignored`);
- a model or effort outside the values above (`roster: roles.reviewer.model "sonet" is no model alias or claude-* id; ignored`);
- a required slot set to `disabled`, or a slot value that is no skill name: the default skill is kept;
- a missing `version`, or another version: read as version 1;
- an `enforce` that is unreadable, or neither `true` nor `false`: `roster: enforce is unreadable; the roster is not enforced until the file is fixed`;
- a role's `agent` the session never offered: `roster: roles.reviewer.agent "my-plugin:reviewer" names no offered agent; forge-sdlc:reviewer spawns` (see In the pane).

An invalid `## Routing` bullet, while the section lasts, is toasted as before (`routing ignored: model.researcher "sonet-5" is no model alias or claude-* id`). A missing forge.yaml is the defaults and says nothing.

## Enforcement

`roster-guard` is a PreToolUse command hook on `Agent|Skill`. With no forge.yaml, or an `enforce` other than the literal `true`, it gives no decision. Under `enforce: true`:

- An Agent call passes when its `subagent_type` (absent reads as `general-purpose`) is a role default `forge-sdlc:<role>`, a role's `agent`, or in `allow.agents`.
- A Skill call passes when its `skill` is a slot's skill, a `policy` entry, any `forge-sdlc:*` skill, or in `allow.skills`.
- A plugin-qualified entry matches exactly; a bare entry matches that name with or without any plugin prefix, so `allow.agents: [reviewer]` lets every plugin's `reviewer` through.
- Every other call is denied, the lead's and the members' alike, with a fixed reason that names the file and the keys to change, never the matched value.

## In the pane

The run pane reads forge.yaml and forge.md fresh at each `agent.spawn`, and again on each five-second refresh for the band's `roster` note, so an edit shows in the band within one refresh and applies from the next spawn.

- **Swap.** Only a plain spawn of `forge-sdlc:<role>` is swapped: its type becomes the role's `agent`, and one line is appended to its brief, `role contract: <plugin root>/skills/build/ROLES.md#<role>`. Forks, `resume` spawns and workflow agents keep their type. A swap target is used only when the session's `agent.offer` events offered that type; otherwise the default spawns and the band says the entry names no offered agent. The offered set lives in the mod's memory, so it does not survive a hot reload of the mod: until the engine offers the types again, a swap falls back to the default.
- **Mark.** An agent whose role was swapped, or whose model or effort routing overrode, draws `⇄ routed` on its row: the routed model differs from the Agent call's model (else the agent file's frontmatter), or its effort from the frontmatter's. A key repeating the default overrides nothing and leaves no mark.
- **State.** What was applied per agent is in `$.state` under `forge-sdlc.agentRouting` (contract in `types/index.d.ts`), keyed by agent id, with the swapped-in type as `agent`, for the agent table and the run history.
- **Panel.** `/forge agents` shows each role's resolved agent, model and effort, and a slots table.

The tests are `run-pane.routing.test.tsx`, `run-pane.roster.test.tsx` and `run-pane.roster-band.test.tsx` beside the mod, and `forge.roster.test.tsx` for the panel.
