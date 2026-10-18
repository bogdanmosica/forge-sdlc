# 14. The Stop gate counts its blocks instead of trusting stop_hook_active

Status: accepted, 2026-10-17

## Context

The `verified-before-stop` hook stayed quiet whenever the payload's `stop_hook_active` was true. The engine sets that flag on the stop that follows a block, so the gate blocked once and then let the next stop through unchecked. The three-block count, which needs consecutive blocks, could never be reached.

## Decision

The hook ignores `stop_hook_active`. The per-slice count in `.forge/verify/<slug>-<nn>.denials` is the loop guard. Each stop without a fresh green record is blocked with the `verify-record.mjs` command, up to three times. The next stop passes once with a `systemMessage` naming the slice as red, the slice is marked `red` in `state.json`, and the count file is deleted. A fresh green record also deletes it.

## Consequences

- An implementer cannot stop red on its second try: it gets three blocks, each naming the command to run.
- After the red pass the count starts again, so a later fix round in the same worktree gets three blocks of its own.
