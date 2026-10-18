# Crew Stop hook under a blocked stop

Type: research
Status: open
Labels: wayfinder:research
Map: ../map.md

## Question

A member is a full Claude Code session started by crew.sh as `claude --agent forge-sdlc:implementer` in the slice worktree, with forge-sdlc enabled at project scope. Two Stop hooks run in it: cmux-config's `hooks/claude-crew.sh`, which marks the member done, saves the last message as `report.md` and messages the spawning surface; and forge-sdlc's `verified-before-stop`, which blocks the stop while the slice's verify record is not fresh and green, up to three times.

When forge's hook blocks the stop, does the crew hook still mark the member done and wake the lead, so the lead reads a report for a slice that is still being built? Or does a blocked stop reach no other hook, or leave the member `running`? Answer from the engine's documented Stop hook semantics (ordering, what a block does to other hooks, `stop_hook_active`), from `hooks/claude-crew.sh` and `crew.sh sync` in `../cmux-config` and `~/.config/cmux/scripts/crew.sh`, and from `plugins/forge-sdlc/hooks/scripts/verified-before-stop.mjs`. Say what `bin/crew.mjs await` must check before it trusts a done status, and whether any hook change is needed.
