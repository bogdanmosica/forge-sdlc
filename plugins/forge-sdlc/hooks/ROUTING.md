# Routing: model and effort per role from the host config

The run pane mod (`run-pane.tsx`, the pure part in `run-pane/routing.ts`) reads the `## Routing` section of the host config `docs/agents/forge.md` at each `agent.spawn` and applies it to that agent: its model at spawn, its effort on each of its `turn.step`s. The section is optional and `init` does not write it: a host adds it to move cost, and the next spawn reads the edit.

## Shape

```markdown
## Routing
- model.researcher: claude-sonnet-5-5
- effort.researcher: medium
- model.implementer: claude-opus-5-5
- effort.implementer: high
- model.reviewer: claude-opus-5-5
- effort.merger: low
```

- A key is `model.<role>` or `effort.<role>`, where `<role>` is an agent type as the Agent tool names it: a plugin role without its prefix (`researcher` matches the spawn's `forge-sdlc:researcher`) or any other type verbatim (`Explore`). The plugin's roles are `researcher`, `prototyper`, `spec-writer`, `implementer`, `verifier`, `reviewer` and `merger`; their frontmatter in `agents/*.md` is the default.
- `model.<role>`: an alias Claude Code accepts (`opus`, `sonnet`, `haiku`, `fable`, `best`, `default`, `opusplan`, `inherit`) or a full id (`claude-opus-5-5`, with or without the `[1m]` suffix). Pin full ids on a third-party provider, where an alias resolves to another version.
- `effort.<role>`: `low`, `medium`, `high`, `xhigh` or `max`.
- Either key alone is enough. The other sections of the file are not the mod's; the mod reads `## Crew` for the agents' names and `## Mark` (`text`, `color`) for the word at the left of the band; a hex colour is quoted (`- color: "#8b5cf6"`), since a bare `#` starts a comment.

## Precedence

Frontmatter is the default, routing the override, the engine above both: `CLAUDE_CODE_SUBAGENT_MODEL` with `_FORCE=1`, `CLAUDE_CODE_EFFORT_LEVEL` and the `maxEffortLevel` cap still win. A routed model also replaces a model the dispatching skill passed on the Agent call, so a skill's own choice yields to the host's. A fork inherits its parent and is left alone; an agent whose model takes no effort (Haiku) keeps its steps as they are.

## Invalid bullets

A bullet whose value is outside the values above, or whose key is neither `model.<role>` nor `effort.<role>`, is ignored on its own and the frontmatter default applies for that key. Each problem is toasted once (`routing ignored: model.researcher "sonet-5" is no model alias or claude-* id`) and stays in the band above the prompt while the bullet stays invalid. A missing file or a missing `## Routing` section is no routing and says nothing.

## In the pane

An agent whose model or effort routing overrode draws `⇄ routed` on its row: the bullet's model differs from the Agent call's model (else the agent file's frontmatter), or its effort from the frontmatter's. A bullet repeating the default overrides nothing, so it leaves no mark. What was applied per agent is in `$.state` under `forge-sdlc.agentRouting` (contract in `types/index.d.ts`), keyed by agent id, for the agent table and the run history.
