# 13: workflow-as-code-09: The PR body's Workflow section

Type: slice
Status: open
Labels: ready-for-agent
Spec: `docs/efforts/workflow-as-code/spec.md` on `feat/workflow-as-code`

**What to build:** Each stage that rewrites the PR body also rewrites its `## Workflow` section after its state write: the output of `bin/workflow.mjs --mermaid --effort <slug>` in a fenced `mermaid` block, every other section kept verbatim; without a remote the section goes into `PR.md`; intent writes it first

**Blocked by:** workflow-as-code-08

- [ ] wayfinder (intent), spec, plan and build each name the `## Workflow` rewrite after their state write
- [ ] the fenced `mermaid` block from `--mermaid --effort <slug>`
- [ ] every other section verbatim
- [ ] `PR.md` without a remote

## Proof

```sh
node --test tests/workflow-pr-section.test.mjs
```

passes: each stage that rewrites the PR body names the Workflow section
