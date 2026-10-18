---
type: regex
target: {source: file, path: docs/efforts/word-count/PR.md}
pattern: '^## Evidence$(?:(?!^## )[\s\S])*word-count-01(?:(?!^## )[\s\S])*word-count-02(?:(?!^## )[\s\S])*word-count-03'
flags: m
---

One Evidence bullet per slice, from its verify record.
