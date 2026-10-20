---
name: plan
description: Break an approved spec into tracer-bullet slices with Matt's to-tickets, quiz the engineer (Gate 3), publish the tickets, and commit docs/efforts/<slug>/plan.md on feat/<slug>.
disable-model-invocation: true
argument-hint: <slug>
---

`/forge-sdlc:plan <slug>` is Build 1: the breakdown the engineer approves. The procedure is Matt's `to-tickets`, read by file; this skill is the frame: where the slices land, what each carries, who is asked.

## 1. Precondition

- `docs/efforts/<slug>/spec.md` is committed on `feat/<slug>` (`git log -1 -- docs/efforts/<slug>/spec.md` prints a commit) and the checkout is on `feat/<slug>`.
- The spec gate passed: the effort in `.forge/state.json` reads `gate: spec`, and the approval is the human typing this command or, under `autonomous`, the policy passing Gate 2 (spec reported `Gate 2 passed: policy autonomous, nothing open`); a re-run reads `stage: plan` and starts from the published tickets. When spec.md frontmatter still reads `status: draft`, set `status: accepted`; it commits with the plan in step 5.
- Anything missing stops with one line naming it and the command that produces it (`/forge-sdlc:spec <slug>`).
- `node "${CLAUDE_PLUGIN_ROOT}/bin/skill-path.mjs" to-tickets` prints the procedure's file; read it whole. Exit 1 stops with the install line it printed.

Done when spec.md is committed, the state reads `gate: spec` or `stage: plan`, and the to-tickets file is read.

## 2. Draft the slices

Follow to-tickets from `Gather context` through `Draft vertical slices`. The context is `spec.md`, `intent.md`, `map.md` and its closed tickets, the glossary and the ADRs: tracer-bullet slices, each a blocking edge list, prefactoring first, expand–contract for a wide refactor, every rule as the file states it.

- Number the slices `nn` from `01` in dependency order, blockers first. `nn` is the slice branch and worktree, `slice/<slug>-<nn>`, so it is fixed once published.
- Give every slice a **proof** line: one command and the observable that shows the slice done (`node --test tests/x.test.mjs` passes; `pnpm build` emits `dist/x`; an e2e tag runs green). The verifier runs it verbatim in the slice worktree, so it exits non-zero while the slice is missing.
- A slice fits one fresh context window; split one that does not.

Done when every slice has `nn`, title, blocked by, delivers and a proof the host can run.

## 3. Gate 3: the quiz

To-tickets' `Quiz the user` is Gate 3, passed as the [gate policy](../wayfinder/GATE-POLICY.md) says, with `gates.policy` from the host config (`node "${CLAUDE_PLUGIN_ROOT}/bin/forge-config.mjs"`) and `risk` from spec.md.

- Under `attended`, or for a `risk: high` effort, which runs attended: through `AskUserQuestion`, present the slice table, the prefactoring and the risks, and ask its three questions (granularity, blocking edges, merge or split) plus one of this frame's: is each proof the observable the engineer would accept as done? Revise, renumber so `nn` stays dependency order, ask again.
- Under `autonomous` with `risk: normal`: the drafted breakdown is the quiz's answer. Write the four lines of the template's `## Quiz` ([PLAN-TEMPLATE.md](PLAN-TEMPLATE.md)), each a `recommended:` line ending `(source: policy autonomous)`; the breakdown is approved as drafted and Gate 3 passes. Steps 5 and 6 record the lines.

Done when the engineer has answered that the breakdown is approved, or, under `autonomous` with `risk: normal`, the four Quiz lines are written and Gate 3 has passed.

## 4. Publish the tickets

To-tickets' `Publish the tickets` against `docs/agents/issue-tracker.md`: one ticket per slice, blockers first, label `ready-for-agent`. Title `<slug>-<nn>: <title>`; body is to-tickets' template for the tracker (issue or local file) plus `## Proof` (the proof line) and a link to `docs/efforts/<slug>/spec.md` (the path, never a copy). GitHub: the native blocking edges the tracker doc names. Local: `.scratch/<slug>/issues/<nn>-<title>.md` with a `Blocked by:` line. Keep each slice's ticket pointer (`#45`, or the file path) for steps 5 and 6.

Done when the tracker lists one ticket per slice and every blocking edge is on it.

## 5. Write plan.md and commit

Write `docs/efforts/<slug>/plan.md` from [PLAN-TEMPLATE.md](PLAN-TEMPLATE.md): frontmatter (`risk` from intent.md, `updated` today), one row per slice, order of work as the initial frontier (every slice with no blocker) then what each merge unblocks, risks, prefactoring (or none). Write `## Quiz` after `## Prefactoring` with step 3's four Quiz lines when step 3 wrote them (`autonomous` only); otherwise the template's section is left out. Commit it, with spec.md when step 1 changed it, on `feat/<slug>`: `plan(<slug>): <n> slices`. Push `feat/<slug>` when origin exists.

Done when `git log -1 -- docs/efforts/<slug>/plan.md` prints the commit.

## 6. Gate record and state

- PR body: rewrite only the `## Plan` section with the slice table (nn, title, blocked by, proof) and each ticket's link, and step 3's four Quiz lines under the slice table when step 3 wrote them (`autonomous` only); every other section stays verbatim (`gh pr view --json body`, edit, `gh pr edit --body-file`). Without a remote the same section goes into `docs/efforts/<slug>/PR.md`, committed on `feat/<slug>`.
- State: with `readState` and `writeState` from `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/lib.mjs` (`node --input-type=module -e`), set the effort to `stage: plan`, `gate: plan`, `slices: { "<slug>-<nn>": { "status": "open", "mode": "normal", "ticket": "<pointer>" } }` for every slice, `updatedAt` now, and set or drop `stop` beside `gate` as the reference's State write says.

Done when `.forge/state.json` reads back `stage: plan`, `gate: plan`, one open slice per row of the table, and `stop: risk-high`, or no `stop`.

## 7. Report

Three lines: the plan commit, the tickets (pointers, frontier first), and the next command, `/forge-sdlc:build <slug>`; a stopped Gate 3 under `autonomous` names its own on the fourth line instead. Under `autonomous` a fourth line ends it:

- passed: `Gate 3 passed: policy autonomous, nothing open`, on which wayfinder's Resume continues into build.
- stopped: the reason (`risk-high`) and `/forge-sdlc:wayfinder <slug>` to resume, as the reference says.

Done when the state reads back and the report is printed.
