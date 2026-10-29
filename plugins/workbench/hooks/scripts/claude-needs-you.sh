#!/bin/bash
# claude-needs-you: while a Claude session is truly blocked on you (permission
# prompt, question, plan approval, MCP input form), title its cmux terminal tab
# "❓ <reason>". The sidebars (boards.js, workspaces-status.js)
# treat a title starting with "❓" as the needs-you marker and show the text
# after it as the reason, because cmux's own needs_input also fires for
# Claude's idle notice and is ignored there for Claude.
#
# Reasons (the contract is in cmux-config's CLAUDE.md, "claude-needs-you.sh"):
#   ❓ permission: <tool>  Notification permission_prompt (fires only once a
#                          prompt is really shown, after ~6 s without typing;
#                          the tool comes from tool_name if present, else from
#                          the message "Claude needs your permission to use
#                          Bash", else the title is just "❓ permission").
#                          PermissionRequest is deliberately NOT used: it fires
#                          even when auto mode grants the call, so the marker
#                          would flicker on every tool call.
#   ❓ question            PreToolUse AskUserQuestion
#   ❓ plan review         PreToolUse ExitPlanMode
#   ❓ input               Notification elicitation_dialog
#   ❓ needs you           anything else (unparseable or empty stdin included)
#
# Wired in the workbench plugin's hooks/hooks.json:
#   set   - Notification (permission_prompt|elicitation_dialog),
#           PreToolUse (AskUserQuestion|ExitPlanMode)
#   clear - UserPromptSubmit, PostToolUse, PostToolUseFailure (a denied
#           permission ends in a failure, not a PostToolUse), Stop, SessionEnd
#
# Alongside the title, `set` also puts an orange "claude" pill with the same
# reason on the WORKSPACE (cmux set-status, for the built-in sidebar); the ❓
# title stays the source of truth for the custom sidebars. The pill is per
# workspace while the flag is per tab, so `clear` keeps the pill while another
# tab of the same workspace still holds a flag (each flag file stores its
# workspace id).
#
# `set` reads the hook JSON from stdin with one jq call; `clear` reads nothing.
# Never blocks or talks to Claude: no output, always exit 0.
exec >/dev/null 2>&1

surface="$CMUX_SURFACE_ID"
ws="$CMUX_WORKSPACE_ID"
[ -n "$surface" ] && command -v cmux || exit 0

PILL_COLOR="#FF9F0A"   # the sidebars' needs-you orange

# One flag file per tab, so clear only resets titles and pills this hook set
# and costs a single file test on every other tool call.
state="$HOME/.cache/claude-needs-you"
flag="$state/$surface"

# Prints one line, or nothing when jq is missing or stdin is not JSON.
reason() {
  command -v jq >/dev/null || return 0
  jq -r '
    def perm: (
      [ (.tool_name // empty),
        ((.message // "") | capture("to use (?<t>[A-Za-z0-9_:.-]+)") | .t)
      ] | map(select(type == "string" and length > 0)) | first // null
    ) as $t | if $t then "permission: " + $t else "permission" end;
    if type != "object" then "needs you"
    elif .hook_event_name == "PreToolUse" then
      (if .tool_name == "AskUserQuestion" then "question"
       elif .tool_name == "ExitPlanMode" then "plan review"
       else "needs you" end)
    elif .notification_type == "permission_prompt" then perm
    elif .notification_type == "elicitation_dialog" then "input"
    else "needs you" end
  ' 2>/dev/null
}

case "$1" in
  set)
    r=$(reason | head -n1)
    [ -n "$r" ] || r="needs you"
    # The flag goes first, before the title or the pill: `clear` only acts
    # when it exists, so a rename that fails must still leave one behind or
    # the pill set below would never be cleared.
    mkdir -p "$state" && printf '%s\n' "$ws" >"$flag"
    cmux tab-action --surface "$surface" --action rename --title "❓ $r"
    [ -n "$ws" ] && cmux set-status claude "$r" --icon questionmark.bubble --color "$PILL_COLOR" --priority 95 --workspace "$ws"
    ;;
  clear)
    [ -e "$flag" ] || exit 0
    rm -f "$flag"
    cmux tab-action --surface "$surface" --action clear-name
    # Another tab of this workspace still waiting keeps the pill. Flags older
    # than 12h belong to sessions that never cleared (crash, cmux restart).
    find "$state" -type f -mmin +720 -delete 2>/dev/null
    if [ -n "$ws" ] && ! grep -qsx "$ws" "$state"/* 2>/dev/null; then
      cmux clear-status claude --workspace "$ws"
    fi
    ;;
esac
exit 0
