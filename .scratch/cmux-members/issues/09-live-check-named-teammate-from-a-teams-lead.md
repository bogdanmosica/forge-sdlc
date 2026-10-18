# Live check: a named teammate from a teams lead

Type: task
Status: open
Labels: wayfinder:task
Map: ../map.md
Blocked by: none
Worked by: the owner (HITL), from the videobot host. The agent cannot launch a teams lead; it prepared the host, the hook and the worktree there on 2026-10-18.

## Question

Confirm, before the spec is written, the four hypotheses ticket 08 left: (a) a named background Agent call under a teams lead brings the lead back with the completion notification carrying the report; (b) Stop fires inside the split-pane teammate with the teammate's own cwd, the worktree, so `verified-before-stop` holds there; (c) the definition's `disallowedTools` hold in the pane; (d) a name with a space and an apostrophe survives the roster, the mailbox and the Crew panel.

## Prepared by the agent (done)

- forge-sdlc and mattpocock-skills installed in `~/Desktop/personal/videobot` at project scope (`.claude/settings.json` there, untracked).
- The throwaway hook registered in `videobot/.claude/settings.local.json` for Stop, SubagentStop and TeammateIdle; it runs `videobot/.forge/live-check/stop-log.sh`, which appends every payload and the team and cmux variables to `videobot/.forge/live-check/stop.log`. The log path is absolute, so a teammate whose project dir is the worktree still writes there.
- A throwaway worktree at `videobot/.forge/live-check/wt` on branch `live-check/teammate`, which no forge hook watches, so the log is the evidence.

## Checklist (the owner)

1. **Launch a teams lead** in the videobot cmux workspace with the Claude 🤖 tab-bar button (since 2026-10-18 it runs `cmux claude-teams`). The hooks from the local settings file load with that session.

2. **Paste this prompt verbatim** in that lead:

   > Use the Agent tool once, with `subagent_type: "forge-sdlc:implementer"`, `name: "Miles O'Brien"`, `run_in_background: true`, and this prompt: "First Bash call: `cd /Users/mosica.bogdan/Desktop/personal/videobot/.forge/live-check/wt`. Then run `pwd && git branch --show-current` and report both lines. Then say whether the tools named AskUserQuestion and Agent are available to you, by describing your tool list, without calling them. Then stop." Do nothing else: wait, and when something arrives from the teammate, paste it to me verbatim, saying whether it came as a task notification or as a mailbox message.

3. **Collect**, once the lead has reported: the lead's own output from step 2 (notification or message, and its text); the Crew panel's row for the teammate (its name as displayed); and the log:

   ```sh
   cat ~/Desktop/personal/videobot/.forge/live-check/stop.log
   ```

4. **Paste** all three under `## Results` below, then run `/forge-sdlc:wayfinder cmux-members` in the forge-sdlc lead. The resolution records: (a) how the lead was told; (b) which events the log shows for the teammate, with `hook_event_name`, `cwd` and `CLAUDE_PROJECT_DIR`; (c) whether the teammate reported the two tools missing; (d) whether the name survived with its space and apostrophe.

5. **Clean up** (the agent can do this at resolution): in videobot, `git worktree remove .forge/live-check/wt && git branch -D live-check/teammate`, delete `.claude/settings.local.json` and `.forge/live-check/`. The plugin install stays: videobot is the next host.

## Results

(paste here)
