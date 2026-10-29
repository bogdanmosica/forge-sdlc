#!/bin/bash
# claude-crew: mark a crew member's session (one spawned by
# ~/.config/cmux/scripts/crew.sh, which exports $CMUX_CREW_MEMBER, the path of
# its record) done, ended or running, so crew.sh await, crew.sh list and
# the Crew tab of sidebars/boards.js follow it without reading its screen.
#
#   stop    Stop hook. The turn is over: status "done", the hook JSON's
#           last_assistant_message saved as the member's report.md (its first
#           non-heading line becomes the summary in the CREW line), and the
#           orchestrator surface messaged through `cmux agent message` by
#           crew.sh sync.
#   end     SessionEnd hook. Status "ended".
#   prompt  UserPromptSubmit hook. Status "running" (a follow-up prompt or a
#           crew.sh send woke the member up).
#
# Any session that is not a crew member exits on the first env test, so the
# hook costs every other Claude session nothing. Reads the hook JSON from stdin
# with one jq call; never blocks or talks to Claude: no output, always exit 0.
#
# Wired in the workbench plugin's hooks/hooks.json: Stop -> stop, SessionEnd -> end,
# UserPromptSubmit -> prompt.
exec >/dev/null 2>&1

rec="${CMUX_CREW_MEMBER:-}"
[ -n "$rec" ] && [ -f "$rec" ] || exit 0
crew="$HOME/.config/cmux/scripts/crew.sh"
[ -x "$crew" ] || exit 0

case "$1" in
  stop)
    tmp=$(mktemp "${TMPDIR:-/tmp}/claude-crew.XXXXXX") || exit 0
    if command -v jq >/dev/null; then
      jq -r '.last_assistant_message // ""' > "$tmp" 2>/dev/null
    else
      cat > /dev/null
    fi
    "$crew" sync "$rec" done "$tmp"
    rm -f "$tmp"
    ;;
  end)
    cat > /dev/null
    "$crew" sync "$rec" ended
    ;;
  prompt)
    cat > /dev/null
    "$crew" sync "$rec" running
    ;;
esac
exit 0
