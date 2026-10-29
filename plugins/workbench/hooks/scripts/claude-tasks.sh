#!/bin/bash
# claude-tasks: mirror Claude Code's own task list into the cmux workspace
# todo pane and progress bar, so the sidebar shows what the agent is working
# through without opening the session.
#
#   created    TaskCreated hook. `cmux todo add "<task_subject>" --origin agent`
#              and remember task_id -> cmux item id.
#   completed  TaskCompleted hook. `cmux todo check <item>` for that task (a
#              task created before this hook existed is matched by text).
#   clear      SessionEnd hook. Removes the items this session added, drops
#              the mapping and clears the progress bar when no agent items
#              remain; the user's own items are never touched.
#
# After every change the progress bar (`cmux set-progress`) is rebuilt from the
# agent-origin items only (completed / total, label "tasks 2/5", "tasks 5/5 ✓"
# when finished), so your own pending items don't hold the bar back.
#
# Mapping files: ~/.cache/claude-tasks/<session_id>/<task_id> = cmux item id.
# Reads the hook JSON from stdin with one jq call; task text is untrusted and
# only ever quoted (never evaluated), truncated to MAX_TEXT chars. Never blocks
# Claude: no output, always exit 0. Needs $CMUX_WORKSPACE_ID. cmux caps the
# list at 50 items; a failed add is simply skipped.
#
# Wired in the workbench plugin's hooks/hooks.json: TaskCreated -> created,
# TaskCompleted -> completed, SessionEnd -> clear.
exec >/dev/null 2>&1

ws="$CMUX_WORKSPACE_ID"
[ -n "$ws" ] && command -v cmux && command -v jq || exit 0

MAX_TEXT=120
cache_root="$HOME/.cache/claude-tasks"

# Prints session_id, task_id and subject from the hook JSON, one per line in
# that order (an empty line when missing; newlines and tabs flattened). One
# field per line rather than tab-separated: tab is IFS whitespace, so an empty
# field would collapse and shift the ones after it.
read_hook() {
  jq -r '
    def s(v): if (v|type) == "string" or (v|type) == "number" then (v|tostring) else "" end;
    def line: gsub("[\\r\\n\\t]"; " ");
    if type != "object" then ["", "", ""] else
      [ s(.session_id), s(.task_id), s(.task_subject) ] | map(line)
    end | .[]' 2>/dev/null
}

# Rebuilds the progress bar from agent-origin items.
progress() {
  local counts done total
  counts=$(cmux todo list --workspace "$ws" --json 2>/dev/null | jq -r '
    [.items[]? | select(.origin == "agent")] as $a
    | "\([$a[] | select(.state == "completed")] | length) \($a | length)"' 2>/dev/null)
  read -r done total <<<"${counts:-0 0}"
  if [ "${total:-0}" -eq 0 ]; then
    cmux clear-progress --workspace "$ws"
  elif [ "$done" -ge "$total" ]; then
    cmux set-progress 1.0 --label "tasks $done/$total ✓" --workspace "$ws"
  else
    cmux set-progress "$(awk -v d="$done" -v t="$total" 'BEGIN { printf "%.3f", d / t }')" \
      --label "tasks $done/$total" --workspace "$ws"
  fi
}

sid="" tid="" subject=""
{ IFS= read -r sid; IFS= read -r tid; IFS= read -r subject; } < <(read_hook)
sid=${sid//\//_}; tid=${tid//\//_}
map_dir="$cache_root/${sid:-nosession}"

case "$1" in
  created)
    [ -n "$subject" ] || exit 0
    subject=${subject:0:$MAX_TEXT}
    item=$(cmux todo add "$subject" --origin agent --workspace "$ws" --json 2>/dev/null |
      jq -r '.item.id // empty' 2>/dev/null)
    if [ -n "$item" ] && [ -n "$tid" ]; then
      mkdir -p "$map_dir" && printf '%s\n' "$item" >"$map_dir/$tid"
    fi
    progress
    ;;
  completed)
    item=""
    [ -n "$tid" ] && [ -f "$map_dir/$tid" ] && item=$(cat "$map_dir/$tid")
    if [ -z "$item" ] && [ -n "$subject" ]; then
      # Not created through this hook: match a pending agent item by text.
      item=$(cmux todo list --workspace "$ws" --json 2>/dev/null | jq -r --arg t "${subject:0:$MAX_TEXT}" '
        [.items[]? | select(.origin == "agent" and .state != "completed" and .text == $t)][0].id // empty' 2>/dev/null)
    fi
    [ -n "$item" ] && cmux todo check "$item" --workspace "$ws"
    progress
    ;;
  clear)
    if [ -d "$map_dir" ]; then
      for f in "$map_dir"/*; do
        [ -f "$f" ] && cmux todo rm "$(cat "$f")" --workspace "$ws"
      done
      rm -rf "$map_dir"
    fi
    progress
    ;;
esac
exit 0
