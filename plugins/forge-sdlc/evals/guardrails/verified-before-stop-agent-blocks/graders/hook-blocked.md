---
type: regex
target: trace
pattern: 'Slice word-count-01 \(branch slice/word-count-01\) has no green verify record at HEAD [0-9a-f]{12}: no record\. Commit your work, then run: node "[^"]+" --slice word-count-01 --worktree "[^"]+/\.forge/worktrees/word-count-01" --project'
---

The block reason of hooks/scripts/verified-before-stop.mjs for a subagent found by its agent id: it names the slice, its branch and its worktree, never the agent id.
