# Rewriting a call's target

Type: research
Status: open
Labels: wayfinder:research
Blocked by: none
Map: ../map.md

## Question

The roster swaps the agent that fills a role and the skill that fills a slot. The decided mechanism is a resolver (`bin/roster.mjs`) the lead runs before each call, with every `SKILL.md` call site rewritten to use it. Could the swap be transparent instead: can a PreToolUse command hook return a modified tool input (e.g. `hookSpecificOutput.updatedInput`) for the Agent tool's `subagent_type` and the Skill tool's `skill`, and does the engine honour it for both? Can the plugin mod's `agent.spawn` (as `run-pane/routing.ts` uses it for model) change the agent type? What does a swapped agent's prompt see (the brief written for `forge-sdlc:implementer`)? Also: can a PreToolUse hook deny an Agent or Skill call with a reason (needed for enforcement), and does it see the caller (lead vs member)? Answer from Claude Code's hook docs, the engine declarations in `plugins/forge-sdlc/hooks/types/claude-code.d.ts`, and the existing hooks under `plugins/forge-sdlc/hooks/scripts/`. Note: `docs/research/roster-as-code/rewriting-calls.md`.
