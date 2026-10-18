---
type: regex
target: trace
match: not_contains
pattern: '\[new branch\][^\n]*-> slice/word-count-01'
---

git's new-branch line never appears: the slice branch did not reach origin.
