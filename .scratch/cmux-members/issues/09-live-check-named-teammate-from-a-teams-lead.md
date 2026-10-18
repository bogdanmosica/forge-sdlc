# Live check: a named teammate from a teams lead

Type: task
Status: open
Labels: wayfinder:task
Map: ../map.md
Blocked by: none
Worked by: the owner (HITL). The agent cannot launch a teams lead; it prepared the hook and the worktree.

## Question

Confirm, before the spec is written, the four hypotheses ticket 08 left: (a) a named background Agent call under a teams lead brings the lead back with the completion notification carrying the report; (b) Stop fires inside the split-pane teammate with the teammate's own cwd, the worktree, so `verified-before-stop` holds there; (c) the definition's `disallowedTools` hold in the pane; (d) a name with a space and an apostrophe survives the roster, the mailbox and the Crew panel.

## Checklist

Steps 1 and 2 were done by the agent on 2026-10-18 (the hooks are in `.claude/settings.local.json` beside its existing MCP setting; the worktree is cut). The owner starts at step 3.

1. **Register the throwaway hook** in this repo (not committed; the file is gitignored). Create `.claude/settings.local.json` with:

   ```json
   {
     "hooks": {
       "Stop": [{ "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.forge/live-check/stop-log.sh", "timeout": 5 }] }],
       "SubagentStop": [{ "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.forge/live-check/stop-log.sh", "timeout": 5 }] }],
       "TeammateIdle": [{ "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.forge/live-check/stop-log.sh", "timeout": 5 }] }]
     }
   }
   ```

   The script `.forge/live-check/stop-log.sh` appends every payload and the team and cmux variables to `.forge/live-check/stop.log`. Remove the file after the check.

2. **Cut a throwaway worktree** from the repo root, on a branch no forge hook watches:

   ```sh
   git worktree add .forge/live-check/wt -b live-check/teammate feat/cmux-members
   ```

3. **Launch a teams lead** in this repo's cmux workspace with the Claude 🤖 tab-bar button (since 2026-10-18 it runs `cmux claude-teams`). In that lead, paste this prompt verbatim:

   > Use the Agent tool once, with `subagent_type: "forge-sdlc:implementer"`, `name: "Miles O'Brien"`, `run_in_background: true`, and this prompt: "First Bash call: `cd /Users/mosica.bogdan/Desktop/personal/forge-sdlc/.forge/live-check/wt`. Then run `pwd && git branch --show-current` and report both lines. Then say whether the tools named AskUserQuestion and Agent are available to you, by trying to describe your tool list, without calling them. Then stop." Do nothing else: wait, and when something arrives from the teammate, paste it to me verbatim, saying whether it came as a task notification or as a mailbox message.

4. **Collect**, once the lead has reported: the lead's own output from step 3 (notification or message, and its text); the Crew panel's row for the teammate (its name as displayed); and the log:

   ```sh
   cat .forge/live-check/stop.log
   ```

5. **Paste** all three here, then run `/forge-sdlc:wayfinder cmux-members`. The resolution records: (a) how the lead was told; (b) which events the log shows for the teammate, with `hook_event_name`, `cwd` and `CLAUDE_PROJECT_DIR`; (c) whether the teammate reported the two tools missing; (d) whether the name survived with its space and apostrophe.

6. **Clean up**: `git worktree remove .forge/live-check/wt && git branch -D live-check/teammate`, delete `.claude/settings.local.json`.
