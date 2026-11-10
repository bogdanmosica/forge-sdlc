---
type: regex
target: trace
pattern: 'Slice word-count-01 \(branch slice/word-count-01\) has no green verify record at HEAD [0-9a-f]{12}: no record\. Commit your work, then run: node "[^"]+" --slice word-count-01 --worktree "[^"]+-worktrees/word-count-01" --project "[^"]+/projects/word-count"'
---

The block reason of hooks/scripts/verified-before-stop.mjs for a slice worktree beside the repository of a subfolder host: the project is the host folder, found through git and the host's state, not the repository root.
