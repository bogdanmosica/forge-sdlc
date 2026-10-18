# Stop payload cwd in a member

Type: research
Status: resolved
Labels: wayfinder:research
Map: ../map.md

## Question

`verified-before-stop` decides from the payload's `cwd` whether the stopping session is in a slice checkout (branch `slice/<slug>-<nn>`), and then reads `.forge/verify/<slug>-<nn>.json` in the host. Today the implementer is a subagent and the hook fires as `SubagentStop`, where the payload's `cwd` was an open item after the first build. In a member the implementer is the whole session, started by crew.sh with the worktree as its working directory, and the hook fires as `Stop`.

What does the `Stop` payload carry as `cwd` in that case: the directory the session was launched in, or the directory of the last Bash call? Does the implementer's rule "your first Bash call is `cd <worktree>`" still matter? Answer from the engine's hook payload documentation and from `plugins/forge-sdlc/hooks/scripts/verified-before-stop.mjs` and `lib.mjs`. Say whether the hook reads the slice branch correctly in a member without change, and if not, what the smallest change is.

## Answer

The Stop payload's `cwd` is the session's current directory when the hook fires: the launch directory, which crew.sh sets to the worktree, then whatever the last `cd` chose. `verified-before-stop` reads the slice branch from that cwd through git, and derives the project from the git common dir, so the verify record is read in the host whatever subfolder the member is in. No hook change. The implementer's "first Bash call is `cd <worktree>`" rule stays as the guard against a later `cd` out of the worktree, which would make the hook see the effort branch and allow the stop.

One consequence for the spec: in a member `CLAUDE_PROJECT_DIR` is the worktree, so the hook reads `docs/agents/forge.md` from the slice's checkout; it is committed on the effort branch, so it is there. Optional hardening: a test with a Stop payload whose cwd is a subfolder of the worktree.

Note: `docs/research/cmux-members/stop-payload-cwd-in-a-member.md`. Resolved 2026-10-18.
