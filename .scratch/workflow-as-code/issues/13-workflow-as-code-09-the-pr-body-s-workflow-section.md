# 13: workflow-as-code-09: The PR body's Workflow section

Type: slice
Status: resolved
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** Each stage that rewrites the PR body also rewrites its `## Workflow` section after its state write: the output of `bin/workflow.mjs --mermaid --effort <slug>` in a fenced `mermaid` block, every other section kept verbatim; without a remote the section goes into `PR.md`; intent writes it first

**Blocked by:** workflow-as-code-08

- [x] wayfinder (intent), spec, plan and build each name the `## Workflow` rewrite after their state write
- [x] the fenced `mermaid` block from `--mermaid --effort <slug>`
- [x] every other section verbatim
- [x] `PR.md` without a remote

- recommended: each stage rewrites `## Workflow` at its gate step, after its own state write and after any stop that step writes, so the diagram shows a stop the moment it is recorded: wayfinder step 7, spec step 7, plan step 6, build step 4 (source: spec, "Each stage that rewrites the PR body also rewrites its `## Workflow` section after its state write")
- recommended: `## Workflow` sits third among the PR body sections in docs/contracts.md, after `## Assumptions to confirm` and before `## Spec`, since Gate 1 writes it first (source: spec, "intent writes it first"; docs/contracts.md, "Owned sections, in order")
- recommended: `/forge-sdlc:intent`, which rewrites `## Intent` but writes no state, does not rewrite `## Workflow` (source: spec, "after its state write")

## Proof

```sh
node --test tests/workflow-pr-section.test.mjs
```

passes: each stage that rewrites the PR body names the Workflow section

## Comments

merged c4e808e83abdb7f878a91f5f35ce07b21323d912; review record: /Users/mosica.bogdan/Desktop/personal/forge-sdlc/.forge/review/workflow-as-code-09.md (clean)
