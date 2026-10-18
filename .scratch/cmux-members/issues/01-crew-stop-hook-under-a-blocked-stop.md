# Crew Stop hook under a blocked stop

Type: research
Status: resolved
Labels: wayfinder:research
Map: ../map.md

## Question

A member is a full Claude Code session started by crew.sh as `claude --agent forge-sdlc:implementer` in the slice worktree, with forge-sdlc enabled at project scope. Two Stop hooks run in it: cmux-config's `hooks/claude-crew.sh`, which marks the member done, saves the last message as `report.md` and messages the spawning surface; and forge-sdlc's `verified-before-stop`, which blocks the stop while the slice's verify record is not fresh and green, up to three times.

When forge's hook blocks the stop, does the crew hook still mark the member done and wake the lead, so the lead reads a report for a slice that is still being built? Or does a blocked stop reach no other hook, or leave the member `running`? Answer from the engine's documented Stop hook semantics (ordering, what a block does to other hooks, `stop_hook_active`), from `hooks/claude-crew.sh` and `crew.sh sync` in `../cmux-config` and `~/.config/cmux/scripts/crew.sh`, and from `plugins/forge-sdlc/hooks/scripts/verified-before-stop.mjs`. Say what `bin/crew.mjs await` must check before it trusts a done status, and whether any hook change is needed.

## Answer

Most likely yes. The engine runs every matching Stop hook in parallel, so a block from `verified-before-stop` does not suppress cmux-config's crew hook: each blocked stop marks the member `done`, saves the last message as `report.md` and messages the lead, up to four times per slice, while the member keeps working. `crew.sh await` trusts the status field alone and would return on the first blocked stop.

Decision for the spec: `bin/crew.mjs await` never trusts `done` by itself. A member is settled only when `.forge/verify/<slug>-<nn>.json` is green at the worktree's current HEAD, or the slice is marked `red` in `state.json` with its denials count gone; any other `done` is treated as still running and awaited again. No hook change: making the crew hook skip blocked stops would couple a generic cmux-config hook to forge internals. The parallel-peers behaviour is a hypothesis the docs do not state outright; the await check is needed under either reading, so it is not ticketed further.

Note: `docs/research/cmux-members/crew-stop-hook-under-a-blocked-stop.md`. Resolved 2026-10-18.
