# Rewriting a call's target

Type: research
Status: resolved
Labels: wayfinder:research
Blocked by: none
Map: ../map.md

## Question

The roster swaps the agent that fills a role and the skill that fills a slot. The decided mechanism is a resolver (`bin/roster.mjs`) the lead runs before each call, with every `SKILL.md` call site rewritten to use it. Could the swap be transparent instead: can a PreToolUse command hook return a modified tool input (e.g. `hookSpecificOutput.updatedInput`) for the Agent tool's `subagent_type` and the Skill tool's `skill`, and does the engine honour it for both? Can the plugin mod's `agent.spawn` (as `run-pane/routing.ts` uses it for model) change the agent type? What does a swapped agent's prompt see (the brief written for `forge-sdlc:implementer`)? Also: can a PreToolUse hook deny an Agent or Skill call with a reason (needed for enforcement), and does it see the caller (lead vs member)? Answer from Claude Code's hook docs, the engine declarations in `plugins/forge-sdlc/hooks/types/claude-code.d.ts`, and the existing hooks under `plugins/forge-sdlc/hooks/scripts/`. Note: `docs/research/roster-as-code/rewriting-calls.md`.

## Answer

Resolved 2026-11-22 by the researcher (Hoshi-Sato); note `docs/research/roster-as-code/rewriting-calls.md`.

- **Agent: transparent swap in the mod.** `agent.spawn` may rewrite `subagentType` to another dispatchable agent (exact name; an unknown name refuses the spawn), the same hook that applies model routing today. Not PreToolUse `updatedInput` / `tool.call`: a rewrite there lands after auto mode's review and is refused, as crew naming already found. The swapped agent runs its own definition with the call's brief unchanged. Caveats: routing records are keyed by the original type, so lookups go by role; the "overridden" mark must compare against the swapped-in definition.
- **Skill: no documented transparent swap.** A rewrite of the Skill tool's `skill` is type-legal at `tool.call` but undocumented and hits the auto-mode gap; `skill.prompt` can replace the text the model reads (enough for `disabled`, or a text swap) but not which skill ran. Skill slots stay with an explicit resolver unless a live test proves otherwise.
- **Enforcement feasible.** A PreToolUse command hook (`Agent|Skill` matcher) denies with a reason in every mode; `agent_id` in the payload tells a member from the lead. The mod can also `{ deny }` at `agent.spawn` and hide types with `agent.offer`.
- Hypotheses for the build to prove live: `subagentType` rewrite at spawn passes auto mode; a swapped-in implementer finishes a slice from the unchanged brief.
