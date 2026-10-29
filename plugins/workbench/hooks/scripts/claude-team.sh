#!/bin/bash
# claude-team: keep the "TEAM …" description line of Claude Code agent teams
# (lead + named teammates started with `cmux claude-teams`) fresh, so
# the Crew tab of sidebars/boards.js lists the team. Runs
# ~/.config/cmux/scripts/refresh-teams.sh, which reads the rosters under
# ~/.claude/teams/ and `cmux sessions --json --all`, detached so the hook
# returns at once.
#
#   SessionStart  a teammate's session came up (its tab is now known)
#   Stop          a lead or teammate finished a turn
#   SessionEnd    a teammate or the lead went away (Claude deletes the team
#                 folder with the lead; the line is then removed)
#
# Gate: the hook fires on every Claude session's Stop, so before spawning
# anything it exits unless there is work: a team roster exists
# (~/.claude/teams/*/config.json, a glob test, no process) or the flag file
# ~/.cache/cmux-teams/active exists. The refresher keeps that flag: it is
# present while at least one workspace carries a TEAM line, so a line left by
# a team whose folder is already gone still gets cleaned up, and removed once
# no workspace has one. The gate costs no process for a session that is not
# part of a team.
#
# Reads nothing from stdin; never blocks or talks to Claude: no output,
# always exit 0. Wired in the workbench plugin's hooks/hooks.json on those three events.
exec >/dev/null 2>&1
found=""
for f in "$HOME"/.claude/teams/*/config.json; do [ -e "$f" ] && found=1; break; done
[ -n "$found" ] || [ -e "$HOME/.cache/cmux-teams/active" ] || exit 0
cat >/dev/null
command -v cmux || exit 0
script="$HOME/.config/cmux/scripts/refresh-teams.sh"
[ -x "$script" ] || exit 0
# SessionEnd of the lead: the folder is removed a moment after the hook, so
# give the refresher a short head start before it looks.
case "$1" in
  end) (sleep 2; "$script") & ;;
  *) "$script" & ;;
esac
exit 0
