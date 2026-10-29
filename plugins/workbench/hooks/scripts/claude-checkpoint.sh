#!/bin/bash
# claude-checkpoint: Stop hook that names a cmux Vault checkpoint after the
# turn that just ended, so the Vault timeline (and `cmux vault checkpoints`)
# reads like a changelog and a fork or restore can pick a turn by what it did
# instead of by number. The name is the first non-heading line of
# last_assistant_message (markdown list markers and quotes stripped), cut at
# MAX_CHARS, the same line hooks/claude-log.sh puts in the workspace log.
#
#   cmux vault checkpoint --agent claude --session <session_id> --name <line>
#
# The checkpoint sits at the session's current tip, which at Stop time is the
# finished turn. Everything comes from the hook JSON on stdin (one jq call)
# and is untrusted text: only ever quoted, never evaluated. The cmux call runs
# in the background so Claude never waits on the socket; no output, always
# exit 0. A turn without a usable line gets no manual checkpoint (cmux still
# derives one per turn on its own).
#
# Wired in the workbench plugin's hooks/hooks.json: Stop -> claude-checkpoint.sh
exec >/dev/null 2>&1
command -v cmux && command -v jq || exit 0

MAX_CHARS=80

sid="" line=""
{ IFS= read -r sid; IFS= read -r line; } < <(jq -r '
  def s(v): if (v|type) == "string" then v else "" end;
  if type != "object" then "\n" else
    [ s(.session_id),
      ( s(.last_assistant_message)
        | split("\n")
        | map(select(test("^\\s*#") | not))
        | map(sub("^[*>\\-\\s]+"; "") | gsub("\\s+"; " ") | gsub("^ | $"; ""))
        | map(select(length > 0)) | .[0] // "" )
    ] | map(gsub("[\\r\\t]"; " ")) | .[]
  end' 2>/dev/null)
[ -n "$sid" ] && [ -n "$line" ] || exit 0
line=${line:0:$MAX_CHARS}

cmux vault checkpoint --agent claude --session "$sid" --name "$line" >/dev/null 2>&1 &
exit 0
