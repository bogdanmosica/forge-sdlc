# Assumption lines

A gap is anything Gate 1's reader needs settled that no closed ticket settles. Each gap is one line in a bullet list under `## Assumptions to confirm` (intent.md, spec.md, the PR body), in one of two shapes:

```markdown
- open: <the question only the owner can settle>
- recommended: <the reading taken> (source: <ticket name, doc, or "none">)
```

- **open**: the owner must answer; `/forge-sdlc:spec` stops on it with the question. Phrase it as a question with its options.
- **recommended**: the reading the artifacts support, taken so the loop continues; the owner confirms or overturns it at the gate. The source is the ticket name or doc it rests on, or `"none"` when it rests on judgement alone.

List every `open` line first, then the `recommended` lines. With no gap, the section reads `none`.
