#!/bin/bash
# claude-statusline-clear.sh: SessionEnd hook that runs the status line
# script's `clear` mode (drop the session's ~/.cache/claude-ctx files, the ctx
# pill and the CTX / CACHE description lines) through the one copy of that
# script the user wired as `statusLine.command` in ~/.claude/settings.json.
# The plugin keeps no copy of the status line script, so the cache layout the
# status line writes and the one `clear` removes always come from the same
# file. The hook's stdin (the SessionEnd JSON with session_id) is handed on.
#
# Runs only when the command's file name starts with "claude-statusline", so a
# different status line tool is never called with an argument it does not
# know. Silent, exit 0 in every case: a hook's stdout reaches Claude as context.
# CLAUDE_SETTINGS_FILE overrides the settings path (tests).
set -u

settings="${CLAUDE_SETTINGS_FILE:-$HOME/.claude/settings.json}"
[ -r "$settings" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

cmd=$(jq -r '.statusLine.command // empty' "$settings" 2>/dev/null) || exit 0
[ -n "$cmd" ] || exit 0
case "$cmd" in
  "~/"*) cmd="$HOME/${cmd#\~/}" ;;
esac
[ -f "$cmd" ] || exit 0
case "$(basename "$cmd")" in
  claude-statusline*) ;;
  *) exit 0 ;;
esac

/bin/bash "$cmd" clear >/dev/null 2>&1 </dev/stdin
exit 0
