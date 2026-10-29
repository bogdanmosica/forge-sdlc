---
name: cmux-crew
description: Run a visible team of Claude Code sessions in cmux, one pane or tab per member, instead of invisible in-session subagents. Use only when the user explicitly asks for cmux-visible sessions, a cmux team or crew, `cmux claude-teams`, `crew.sh`, "like cmux-team", or tasks, research or reviews as separate watchable cmux tabs; also when a lead or orchestrator session started this way must spawn members, wait for them, read their results, or clean them up. Not for a host pipeline's own orchestration: emag-sdlc's build, wayfinder and slice-review, emag-sdlc's implementer, merger and code-reviewer subagents and emag-sdlc's crew theme; forge-sdlc's stages and its named members, which are Agent-tool calls with a `name` under a `cmux claude-teams` lead, never crew.sh; and pocock-skills code-review or implement-spec. All of those keep their Agent-tool subagents.
---

# Visible teams in cmux

Two ways to run a team where every member is a real Claude Code session you can
watch and click into. Both show up in the Teams right panel (tab bar button
Boards, Crew tab) with status, task and subagent pills per member.

## 1. Claude Code agent teams (preferred)

Claude's own teams: a lead session spawns **named teammates**, each a separate
session in its own cmux split, talking through Claude's mailbox and shared task
list. cmux hosts it natively.

- **Start a lead**: palette entry **Claude team**, or in any terminal of the
  workspace:
  ```bash
  cmux claude-teams [claude args…]      # e.g. --model sonnet --permission-mode auto
  ```
  It enables teams for that session and makes every named teammate open as a
  split pane. Plain `claude` runs teammates in-process instead (no panes).
- **Spawn teammates** from the lead: one Agent tool call per teammate with a
  distinct `name` (a short role), all in one message so they run in parallel. A
  `subagent_type` from `.claude/agents/`, `~/.claude/agents/` or a plugin gives
  the teammate that definition's prompt, tools and model.
- **Coordinate**: the lead addresses teammates by name (SendMessage) and shares
  work through TaskCreate / TaskList; teammates report back the same way. Hooks
  `TeammateIdle`, `TaskCreated` and `TaskCompleted` carry `teammate_name` and
  `team_name`.
- **Watch**: the Teams panel lists the lead and each teammate (team colour,
  model, prompt) with needs-you / working / idle / ended from cmux's live agent
  status. The roster comes from `~/.claude/teams/<team>/config.json`, folded
  into a `TEAM` workspace line by `~/.config/cmux/scripts/refresh-teams.sh`
  (run by the workbench plugin's `hooks/scripts/claude-team.sh` on SessionStart, Stop and SessionEnd).
- **Ends** with the lead: Claude removes the team folder when the lead session
  exits, and the panel row set goes with it.

## 2. Ad hoc crew members (`crew.sh`)

For a member outside a Claude team: any agent role, any repo, optionally its own
git worktree, with a file report and a wake-up message for whoever spawned it.
One script: `~/.config/cmux/scripts/crew.sh`.

```bash
~/.config/cmux/scripts/crew.sh spawn --role <agent> --task '<what to do, with pointers>' \
  [--worktree <branch> [--base <ref>]] [--model <m>] [--effort <e>] \
  [--permission-mode auto] [--name <display name>] [--repo <dir>] [--focus]
```

- `--role` is any agent name Claude Code resolves from the repo: a built-in
  (`general-purpose`, `Explore`), one from `.claude/agents/` or
  `~/.claude/agents/`, or a plugin agent (`<plugin>:<agent>`).
- `--task` is the member's first prompt; pointers only (paths, branch, what to
  report). `--task @file` reads it from a file.
- `--worktree <branch>` puts the member in a worktree at `<parent>/<repo>-<slug>`
  on that branch, created from the repo's current branch or `--base`;
  `node_modules` is linked from the main checkout, never installed.
- Unattended members need `--permission-mode auto`; otherwise they stop at the
  first permission prompt and the panel shows them as "needs you".

The command prints `MEMBER=<id> NAME=… SURFACE=surface:N CWD=… RECORD=…`. Keep
the member id for the commands below.

```bash
~/.config/cmux/scripts/crew.sh await <id>... | all [--timeout <s>]   # exit 0 settled, 2 timeout
~/.config/cmux/scripts/crew.sh list [--json]
~/.config/cmux/scripts/crew.sh send <id> '<follow-up prompt>'
~/.config/cmux/scripts/crew.sh close <id>... | done | all [--remove-worktree]
~/.config/cmux/scripts/crew.sh forget <id>... | closed | all
```

- A member is **done** when its turn ends (Stop hook). Its last message is
  saved as `~/.cache/cmux-crew/<workspace id>/<id>/report.md`; read that file
  for the result, never the member's screen. `await` prints
  `MEMBER=… STATUS=… REPORT=<path>` per member.
- When a member finishes, cmux delivers "<name> (<role>, crew member <id>)
  finished: <summary>. Report: …" to the spawning surface; an idle session is
  woken by it, so a background `await` and the message both work.
- `send` delivers a follow-up through cmux agent messaging (never typed into
  the member's prompt) and marks it running again.
- A member that needs a person shows "needs you" with the reason; `await` says
  so once on stderr and keeps waiting. Tell the user who is blocked and on
  what; do not answer for them.
- `close` closes the tab; `--remove-worktree` removes the worktree and deletes
  its local branch only when the checkout is clean. `forget` drops the records
  and the panel rows.

## Which one

Claude teams when the lead should coordinate (shared tasks, messages, one
workspace). `crew.sh` when a member needs its own worktree or branch, a role
from another repo's agents, a file report, or when no lead session exists (a
script or a person spawns it). Both can run side by side in one workspace.
