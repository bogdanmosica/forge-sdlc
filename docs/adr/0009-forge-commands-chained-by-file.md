# 9. forge-sdlc commands are chained by file

Status: accepted, 2026-10-17

## Context

Every forge-sdlc command is user-invoked (`disable-model-invocation: true`), and the Skill tool refuses such a skill when it is called from inside a skill or an agent. Two places chain commands anyway: `wayfinder <slug>` runs the effort's next stage, and the merger runs `slice-review`.

## Decision

Inside the loop, a forge-sdlc command is run by reading `${CLAUDE_PLUGIN_ROOT}/skills/<name>/SKILL.md` and following it. This is the same move the loop makes for Matt's user-invoked skills through `bin/skill-path.mjs`. `bin/effort-state.mjs` decides which stage comes next. It reads `.forge/state.json`, or re-derives the stage from the artifacts on `feat/<slug>` when the state is lost.

## Consequences

- The human types one command per gate. The skills stay user-invoked, so none of them fires on loose phrasing.
- A file read by the Read tool is not substituted, so `${CLAUDE_PLUGIN_ROOT}` stays literal in it, and the Bash tool has no such environment variable. The reader (wayfinder's resume, the merger) names the resolved root for it.
- A chained skill's report wording is part of the chain. Resume continues from `spec` into `plan` on `Gate 2 passed`, so changing that line means changing resume too.
- The merger is itself a subagent and spawns reviewer, implementer and verifier agents through slice-review: two layers below the main session. The engine allows a subagent to spawn subagents up to three layers down by default (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`); a host that sets it to 1 has to run slice-review in the main session.
