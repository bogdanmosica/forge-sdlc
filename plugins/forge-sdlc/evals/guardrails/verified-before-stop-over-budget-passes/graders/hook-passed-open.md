---
type: regex
target: trace
pattern: 'Slice word-count-01 stops over its context budget \(1k\) without a green verify record \(no record\)\. It stays open, not red'
---

The pass of hooks/scripts/verified-before-stop.mjs for a subagent past its context budget: it names the slice and the budget, never the agent id, and leaves the slice open.
