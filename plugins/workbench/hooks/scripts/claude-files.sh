#!/bin/bash
# claude-files: PostToolUse hook (Write|Edit|MultiEdit|NotebookEdit) that keeps
# a "recently touched files" line in the workspace description, which focus.js
# lists as clickable items (Zed's follow-the-agent crosshair, as a list):
#
#   FILES <path>|<path>|...     newest first, at most MAX entries, no repeats
#
# Paths are relative to the workspace folder when inside it, absolute
# otherwise. The line goes through ~/.config/cmux/scripts/desc-line.sh, so the
# other description lines (MR, GL, JIRA, USAGE, DIFF, COST, DIRS, notes) are
# kept. It runs synchronously (one workspace list, one write; well under a
# second) so two edits in a row cannot race each other's read-modify-write.
# The path comes from the hook JSON on stdin and is untrusted text: only ever
# quoted, never evaluated; a path containing the separator is skipped. Never
# blocks Claude: no output, always exit 0. Needs $CMUX_WORKSPACE_ID.
#
# Wired in the workbench plugin's hooks/hooks.json: PostToolUse, matcher
# "Write|Edit|MultiEdit|NotebookEdit".
exec >/dev/null 2>&1

ws="$CMUX_WORKSPACE_ID"
[ -n "$ws" ] && command -v cmux && command -v jq && command -v python3 || exit 0
MAX=12

path=$(jq -r '
  if type != "object" then "" else
    ((.tool_input.file_path // .tool_input.notebook_path // "") | tostring)
  end' 2>/dev/null | tr -d '\r\n\t')
[ -n "$path" ] || exit 0
case "$path" in *"|"*) exit 0 ;; esac

. "$HOME/.config/cmux/scripts/desc-line.sh" || exit 0

# "<ref>\t<new FILES line>" for this workspace: the path moved to the front of
# the existing list, cut at MAX. Empty when the workspace is unknown.
out=$(cmux workspace list --json 2>/dev/null | python3 -I -c '
import json, sys
ws, path, cap = sys.argv[1], sys.argv[2], int(sys.argv[3])
for w in json.load(sys.stdin)["workspaces"]:
    if ws not in (w.get("id"), w.get("ref")):
        continue
    d = (w.get("current_directory") or "").rstrip("/")
    if d and path.startswith(d + "/"):
        path = path[len(d) + 1:]
    old = []
    for l in (w.get("description") or "").split("\n"):
        if l.startswith("FILES "):
            old = [p for p in l[6:].split("|") if p]
            break
    files = [path] + [p for p in old if p != path]
    print(w["ref"] + "\t" + "FILES " + "|".join(files[:cap]))
    break
' "$ws" "$path" "$MAX")
IFS=$'\t' read -r ref line <<<"$out"
[ -n "$ref" ] && [ -n "$line" ] || exit 0
set_desc_line "$ref" "FILES " "$line"
exit 0
