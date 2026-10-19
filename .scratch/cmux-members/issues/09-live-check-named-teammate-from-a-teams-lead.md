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

4. **Paste** all three under `## Results

### Run 1, 2026-10-19 05:48 UTC: not a teams lead

cmux's session record shows the lead was launched as `/Users/mosica.bogdan/.local/bin/claude` with no arguments, so agent teams were off: no `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` in any hook's environment, no roster under `~/.claude/teams/`, and the Agent tool offered no `name` parameter, so the lead's call carried `subagent_type`, `prompt` and `description` only. The teammate hypotheses (a) to (d) are therefore not exercised. The run did settle the plain subagent path:

- The implementer ran as a background subagent and its report reached the lead as a hand-back message ("Another Claude session sent a message"), the same way this harness delivers every subagent report.
- The hook fired as `SubagentStop`, `agent_type: forge-sdlc:implementer`, with `cwd` equal to the lead's project directory (`videobot`), not the worktree the subagent had `cd`'d into. In the same log a subagent started with `isolation: worktree` carried its harness worktree (`.claude/worktrees/agent-…`) as cwd. So a subagent's `cwd` is the directory the harness assigned it, never the directory of its last `cd`. This settles the open item from the first build, and it means `verified-before-stop` cannot see a slice branch for a subagent implementer today: it reads the lead's branch and allows the stop. The guard has only been holding through the implementer's own discipline.
- `disallowedTools` held: the subagent reported AskUserQuestion and Agent absent from both its loaded and deferred tool lists.
- Output of the subagent, verbatim: `pwd` printed the live-check worktree path and `git branch --show-current` printed `live-check/teammate`.

### Rerun needed, from a real teams lead

In a terminal of the videobot cmux workspace start the lead by hand, so the launch is certain:

```sh
cd ~/Desktop/personal/videobot && cmux claude-teams --permission-mode auto
```

Before pasting the prompt, confirm teams are on: ask the lead to run `echo ${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-unset}` in Bash and to say whether its Agent tool has a `name` parameter. Only then paste step 2. The hook file still holds the three entries; the log keeps appending.
