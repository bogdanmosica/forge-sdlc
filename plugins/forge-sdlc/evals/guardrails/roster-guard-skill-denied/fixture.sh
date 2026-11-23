#!/usr/bin/env bash
# A configured host on main with a roster under enforcement and a project-local skill,
# word-stats, that fills no slot and is not under allow.skills: a Skill call to it is outside
# the roster, for a member as for the lead (the seam's payload is a member's).
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
printf 'version: 1\nenforce: true\nallow:\n  agents: []\n  skills: []\n' > docs/agents/forge.yaml
mkdir -p .claude/skills/word-stats
printf -- '---\nname: word-stats\ndescription: Count the words and lines of a file. Use when asked for word stats.\n---\n\nRead the file and report its word and line counts in one line.\n' \
  > .claude/skills/word-stats/SKILL.md
commit "forge config, roster and a local skill"
