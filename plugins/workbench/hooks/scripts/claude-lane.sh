#!/bin/bash
# claude-lane: move a workspace between cmux's status lanes (todo, working,
# needs-attention, review, done) from Claude Code hooks, so the sidebar works
# like a kanban: a turn that leaves changes behind parks the workspace in
# "review"; the next prompt hands the lane back to cmux ("auto").
# refresh-mrs.sh owns the "done" lane (merged MR).
#
#   stop    Stop hook. "review" when the repo has tracked changes
#           (git status --porcelain --untracked-files=no, so untracked files
#           and the index scan of large trees stay cheap) or unpushed
#           commits: ahead of its upstream (git rev-list --count @{u}..HEAD),
#           or, with no upstream at all, ahead of the remote default branch
#           (origin/HEAD, else origin/main or origin/master), since a branch
#           never pushed is unpushed work too. Otherwise releases a "review"
#           pin ("auto"); any other pinned lane is left alone. Not a git work
#           tree: same.
#   prompt  UserPromptSubmit hook. "auto", but only when the current pin is
#           "review" or "done": a lane you pinned by hand (todo, ...) stays.
#
# cmux pins are relative: `status set review` remembers the lane cmux was
# inferring at that moment and clears the pin as soon as the inference moves
# off it. At Stop time cmux may still infer "working" (its own Stop hook
# flips the agent to idle around the same moment), so a pin taken right away
# would evaporate a second later. `stop` therefore returns at once and lets a
# detached background job wait (up to WAIT_MAX_S) for any_agent_running to
# drop before pinning. If another agent in the workspace keeps running the pin
# is taken anyway and cmux clears it when that agent stops.
#
# Reads the hook JSON from stdin with one jq call (cwd, falling back to $PWD).
# Never blocks or talks to Claude: no output, always exit 0. Needs
# $CMUX_WORKSPACE_ID, which cmux exports into every terminal it owns.
#
# Wired in the workbench plugin's hooks/hooks.json: Stop -> "stop", UserPromptSubmit -> "prompt".
exec >/dev/null 2>&1

ws="$CMUX_WORKSPACE_ID"
[ -n "$ws" ] && command -v cmux || exit 0

WAIT_MAX_S=15

lane() { cmux workspace status set "$1" --workspace "$ws"; }

# Prints "<effective lane>|<pinned lane or ->|<1 when an agent is running, else 0>".
# "-" rather than "" because `read` folds consecutive whitespace separators.
state() {
  cmux workspace status --workspace "$ws" --json 2>/dev/null |
    python3 -I -c '
import json, sys
try: d = json.load(sys.stdin)
except Exception: d = {}
o = d.get("override") or {}
print("%s|%s|%s" % (d.get("effective") or "-", (o.get("status") if isinstance(o, dict) else "") or "-",
                    "1" if (d.get("signals") or {}).get("any_agent_running") else "0"))'
}

# Prints "review" or "auto" for the repo at $1.
wanted() {
  local dir="$1" ahead
  git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo auto; return; }
  if [ -n "$(git -C "$dir" status --porcelain --untracked-files=no 2>/dev/null)" ]; then
    echo review; return
  fi
  ahead=$(git -C "$dir" rev-list --count '@{u}..HEAD' 2>/dev/null) || ahead=$(unpushed_without_upstream "$dir")
  [ "${ahead:-0}" -gt 0 ] && echo review || echo auto
}

# Prints how many commits HEAD has that the remote default branch does not,
# for a branch with no upstream (never pushed). Falls back to 0 when there is
# no remote default to compare with, so a repo without origin stays "auto".
unpushed_without_upstream() {
  local dir="$1" base
  base=$(git -C "$dir" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null)
  if [ -z "$base" ]; then
    for b in origin/main origin/master; do
      git -C "$dir" rev-parse -q --verify "$b" >/dev/null 2>&1 && { base="$b"; break; }
    done
  fi
  [ -n "$base" ] || { echo 0; return; }
  git -C "$dir" rev-list --count "$base..HEAD" 2>/dev/null || echo 0
}

case "$1" in
  stop)
    cwd=""
    command -v jq >/dev/null && cwd=$(jq -r 'if type == "object" then (.cwd // "") else "" end' 2>/dev/null)
    [ -d "$cwd" ] || cwd="$PWD"
    want=$(wanted "$cwd")
    if [ "$want" = auto ]; then
      # Only release our own "review" pin; a hand-pinned lane (todo, done...) stays.
      IFS='|' read -r _ pinned _ <<<"$(state)"
      [ "$pinned" = review ] && lane auto
    else
      # Detached so the hook returns immediately; see header for why we wait.
      (
        i=0
        while [ "$i" -lt "$((WAIT_MAX_S * 2))" ]; do
          IFS='|' read -r _ _ running <<<"$(state)"
          [ "$running" = 0 ] && break
          sleep 0.5; i=$((i + 1))
        done
        lane review
      ) &
      disown 2>/dev/null
    fi
    ;;
  prompt)
    IFS='|' read -r _ pinned _ <<<"$(state)"
    case "$pinned" in review|done) lane auto ;; esac
    ;;
esac
exit 0
