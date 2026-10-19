---
name: slice-review
description: Review one slice branch against its effort branch on three axes (Standards, Spec, Bugs and security) through reviewer agents, fix Important findings for up to two rounds, write the review record and end with the verdict clean or red. The merger's review, callable by hand.
disable-model-invocation: true
argument-hint: <slice-branch> [effort-branch]
---

`/forge-sdlc:slice-review <slice-branch> [effort-branch]` reviews one slice. Three **reviewer** agents each take one axis; the axes are reported side by side and never reranked, because a slice can pass one axis and fail another. The procedure of the Standards axis is Matt's `code-review` step 3, read by file; this skill is the frame: the diff, the dispatch, the fix loop, the record, the verdict.

Labels come from [REVIEW.md](../../review/REVIEW.md): **Important** blocks, **Nit** is listed and never blocks.

## 1. Resolve

- The slice branch reads `slice/<slug>-<nn>`; take `<slug>` and `<nn>` from it. The effort branch, when omitted, is `feat/<slug>`. The worktree is `.forge/worktrees/<slug>-<nn>` (the main checkout when absent).
- Both refs resolve: `git rev-parse --verify <effort>` and `git rev-parse --verify <slice>`.
- The diff `git diff <effort>...<slice>` (three dots: against the merge-base) is non-empty.
- `node "${CLAUDE_PLUGIN_ROOT}/bin/skill-path.mjs" code-review` prints the code-review file; exit 1 stops with the install line it printed.
- The slice ticket: `slices["<slug>-<nn>"].ticket` in `.forge/state.json`, else row `<nn>` of `docs/efforts/<slug>/plan.md`. The policy skills: the `## Policy skills` bullets of `docs/agents/forge.md`, or none.

A bad ref or an empty diff stops here with one line naming it. Done when you hold the two refs, the worktree, a non-empty diff, the code-review path and the ticket pointer (or `none`).

## 2. Review

Three Agent calls in one message, so they run in parallel, each a [member call](../build/MEMBERS.md), role `reviewer` (one name run per call), foreground under a plain lead, `subagent_type: "forge-sdlc:reviewer"`. Each prompt is pointers only, one per line, absolute paths:

- first line, one of `Axis: Standards`, `Axis: Spec`, `Axis: Bugs and security`
- the diff command `git diff <effort>...<slice>`, the effort and slice branches, the worktree
- Standards: the code-review file from step 1
- Spec: `docs/efforts/<slug>/spec.md` and the ticket pointer
- Bugs and security: `${CLAUDE_PLUGIN_ROOT}/review/REVIEW.md` resolved, `docs/agents/REVIEW.md` when the host has one, the policy skills by name

Done when all three reports are back, each under its axis heading with `### Important` and `### Nit`.

## 3. Record the round

Append the round to `.forge/review/<slug>-<nn>.md` (written fresh on round 0, so a rerun starts a new record) and print the three reports side by side, verbatim, in axis order:

```markdown
# Review <slug>-<nn>: git diff <effort>...<slice> at <short sha of the slice>

## Round <n>
<the Standards report, each heading one level down: ### Standards, #### Important, #### Nit>
<the Spec report, the same way: ### Spec>
<the Bugs and security report, the same way: ### Bugs and security>
<rounds 1 and 2 only: Fix: <commit range or "none">; Verify: green | red, .forge/verify/<slug>-<nn>.json>
```

Done when the record holds the round and the three reports are printed.

## 4. Fix loop

Round 0 is the first review. When a round has an Important finding on any axis and fewer than two fix rounds have run:

1. **Fix.** One foreground Agent call, `subagent_type: "forge-sdlc:implementer"`, in the same worktree; pointers only, the implementer's build pointers plus the fix: the ticket, `docs/efforts/<slug>/spec.md`, `docs/efforts/<slug>/plan.md` row `<nn>` and its proof line, the effort branch, the worktree on the slice branch, `.forge/notes/<slug>/`, then the record path and the round to fix (`Round <n>`, its Important findings, every axis). Done when the implementer reports and the slice branch has a commit after the reviewed sha.
2. **Verify.** One [member call](../build/MEMBERS.md), role `verifier`, foreground under a plain lead, `subagent_type: "forge-sdlc:verifier"`; pointers, in the verifier's order: `<slug>-<nn>`, the worktree, the project dir (where `.forge/` lives), and the proof command copied from row `<nn>` of `docs/efforts/<slug>/plan.md` (or `none`). Its record writer is `node "${CLAUDE_PLUGIN_ROOT}/bin/verify-record.mjs"`. Done when `.forge/verify/<slug>-<nn>.json` has `head` equal to `git -C <worktree> rev-parse HEAD`; a record that is not `green` is an Important finding of the next round.
3. **Review again**: steps 2 and 3 as round `<n+1>`.

Done when a round has no Important finding, or two fix rounds have run.

## 5. Verdict

- `clean`: the last round has no Important finding and, when a fix ran, the verify record is fresh and green.
- `red`: anything else; the slice branch and worktree stay as they are.

Append to the record:

```markdown
## Verdict
`clean` | `red`: <fix rounds run>; <Important count left per axis>; <Nit count per axis>
```

End with one line: `<slug>-<nn>: clean` or `<slug>-<nn>: red (<the axes with Important findings left>)`, then the record path. Done when the verdict is in the record and printed.
