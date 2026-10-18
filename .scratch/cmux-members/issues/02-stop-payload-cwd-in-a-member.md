# Stop payload cwd in a member

Type: research
Status: open
Labels: wayfinder:research
Map: ../map.md

## Question

`verified-before-stop` decides from the payload's `cwd` whether the stopping session is in a slice checkout (branch `slice/<slug>-<nn>`), and then reads `.forge/verify/<slug>-<nn>.json` in the host. Today the implementer is a subagent and the hook fires as `SubagentStop`, where the payload's `cwd` was an open item after the first build. In a member the implementer is the whole session, started by crew.sh with the worktree as its working directory, and the hook fires as `Stop`.

What does the `Stop` payload carry as `cwd` in that case: the directory the session was launched in, or the directory of the last Bash call? Does the implementer's rule "your first Bash call is `cd <worktree>`" still matter? Answer from the engine's hook payload documentation and from `plugins/forge-sdlc/hooks/scripts/verified-before-stop.mjs` and `lib.mjs`. Say whether the hook reads the slice branch correctly in a member without change, and if not, what the smallest change is.
