#!/bin/bash
# claude-log: a per-workspace activity feed in the cmux sidebar (`cmux log`,
# shown with sidebar.showLog), so a workspace tells you what its agent did
# while you were elsewhere.
#
#   stop            Stop hook. The first non-heading, non-empty line of
#                   last_assistant_message (markdown headings and list or
#                   quote markers stripped), source "claude", level success.
#   subagent-start  SubagentStart hook. "<agent_type> started", source
#                   "subagent", level progress.
#   subagent-stop   SubagentStop hook. "<agent_type>: <first line of its
#                   last_assistant_message>", source "subagent", level info.
#
# Lines are cut at MAX_CHARS and markdown noise at the start of a line (#, *,
# -, >) is stripped. Everything comes from the hook JSON on stdin (one jq
# call) and is untrusted text: only ever quoted, never evaluated. Never
# blocks Claude: no output, always exit 0. Needs $CMUX_WORKSPACE_ID.
#
# Wired in the workbench plugin's hooks/hooks.json: Stop -> stop, SubagentStart ->
# subagent-start, SubagentStop -> subagent-stop.
exec >/dev/null 2>&1

ws="$CMUX_WORKSPACE_ID"
[ -n "$ws" ] && command -v cmux && command -v jq || exit 0

MAX_CHARS=140

# Prints two lines: the agent_type, then the first line of
# last_assistant_message that is not a markdown heading (list markers and
# quotes stripped). Two lines rather than a tab pair: `read` eats a leading tab.
read_hook() {
  jq -r '
    def s(v): if (v|type) == "string" then v else "" end;
    if type != "object" then "\n" else
      [ s(.agent_type),
        ( s(.last_assistant_message)
          | split("\n")
          | map(select(test("^\\s*#") | not))
          | map(sub("^[*>\\-\\s]+"; "") | gsub("\\s+"; " ") | gsub("^ | $"; ""))
          | map(select(length > 0)) | .[0] // "" )
      ] | map(gsub("[\\r\\t]"; " ")) | .[]
    end' 2>/dev/null
}

kind="" line=""
{ IFS= read -r kind; IFS= read -r line; } < <(read_hook)
line=${line:0:$MAX_CHARS}

case "$1" in
  stop)
    [ -n "$line" ] && cmux log --source claude --level success --workspace "$ws" -- "$line"
    ;;
  subagent-start)
    cmux log --source subagent --level progress --workspace "$ws" -- "${kind:-subagent} started"
    ;;
  subagent-stop)
    cmux log --source subagent --level info --workspace "$ws" -- "${kind:-subagent}: ${line:-done}"
    ;;
esac
exit 0
