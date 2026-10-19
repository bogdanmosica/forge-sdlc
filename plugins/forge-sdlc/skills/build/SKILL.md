---
name: build
description: Build an effort's approved plan unattended with Matt's implement-spec, one worktree and implementer per slice, each slice verified, reviewed and merged into feat/<slug>, then mark the PR ready with evidence and red slices (Gate 4).
disable-model-invocation: true
argument-hint: <slug>
---

`/forge-sdlc:build <slug>` is Build 2 and Test, **unattended**: from Gate 3 to Gate 4 nothing asks a question, so `AskUserQuestion` stays out of this run. An open choice takes the reading the spec supports and is recorded on the ticket as `- recommended: <reading> (source: <spec line>)`. The procedure is Matt's `implement-spec`, read by file and followed step by step; this skill is the frame: which branch, which agent, which record, which PR body.

Prompts to agents are **pointers**: paths, ticket ids, branch names, one per line, never pasted text. Every state write uses `readState` and `writeState` from `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/lib.mjs` (`node --input-type=module -e`) on `efforts.<slug>`, with `updatedAt` now.

## 1. Precondition

- `docs/efforts/<slug>/plan.md` is committed on `feat/<slug>` (`git log -1 -- docs/efforts/<slug>/plan.md` prints a commit).
- `.forge/state.json` reads `stage: plan`, `gate: plan` for the effort; a re-run reads `stage: build` and resumes from the slice statuses.
- `node "${CLAUDE_PLUGIN_ROOT}/bin/skill-path.mjs" implement-spec` prints the procedure's file; read it whole. Exit 1 stops with the install line it printed.
- `node "${CLAUDE_PLUGIN_ROOT}/bin/forge-config.mjs" .` prints the host config: `max_parallel_slices` under Gates (default 3).

Anything missing stops with one line naming it and the command that produces it (`/forge-sdlc:plan <slug>`). Done when plan.md is committed, the state reads `gate: plan` (or `stage: build`), and the implement-spec file is read.

## 2. Follow implement-spec under the frame

Set the effort to `stage: build`, `gate: none`, `mode: normal`. Then take implement-spec's steps in order:

- **Step 1**: the spec is `docs/efforts/<slug>/spec.md`, the tickets are the plan's slice table and the tracker per `docs/agents/issue-tracker.md`; the blocked-by column is the task graph.
- **Step 2**: the exploration subagent is one [member call](MEMBERS.md), role `researcher`, `subagent_type: "forge-sdlc:researcher"`: the slug, a brief naming what the tickets need explored, and the note path `.forge/notes/<slug>/<topic>.md`. Every implementer reads `.forge/notes/<slug>/`.
- **Step 3**: the integration branch is `feat/<slug>`: `git fetch origin feat/<slug>` when origin exists, `git switch feat/<slug>`; never create a second one. The draft PR already exists from Gate 1.
- **Step 4**: for each frontier slice, cut its worktree from the tip of `feat/<slug>`: `git worktree add .forge/worktrees/<slug>-<nn> -b slice/<slug>-<nn> feat/<slug>`, then symlink the host's `dependency_dir` (forge.md `## Worktrees`) into it: `ln -s "$PWD/<dir>" .forge/worktrees/<slug>-<nn>/<dir>`, nothing for `none`, and when the key is absent whichever of `node_modules`, `.venv`, `vendor` the host root has. One [member call](MEMBERS.md), role `implementer` with `--slice <slug>-<nn>`, in the background, `subagent_type: "forge-sdlc:implementer"`, pointers: the ticket, `docs/efforts/<slug>/spec.md`, `docs/efforts/<slug>/plan.md` row `<nn>` and its proof line, `feat/<slug>`, the worktree, `.forge/notes/<slug>/`. Right after the call, write the id the Agent result names on `efforts.<slug>.slices["<slug>-<nn>"].agent`, with status `building`.
- **Verifier**: an implementer reports done once the Stop hook let it through, so `.forge/verify/<slug>-<nn>.json` should be fresh (`head` equals `git -C <worktree> rev-parse HEAD`) and green. When it is not, one [member call](MEMBERS.md), role `verifier`, foreground under a plain lead, `subagent_type: "forge-sdlc:verifier"`: the slice `<slug>-<nn>`, the worktree, the project dir, the proof line. Fresh and green: status `verified`. Still not green: the merger runs anyway and marks the slice red from its evidence step.
- **Step 5**: the merger is one [member call](MEMBERS.md) per finished slice, role `merger`, foreground under a plain lead, `subagent_type: "forge-sdlc:merger"`, pointers: `<slug>-<nn>`, the worktree, `slice/<slug>-<nn>`, `feat/<slug>`, the project dir, the ticket. It reviews through slice-review (two fix rounds at most), merges or marks the slice red, and sets the status `merged` or `red`.
- **Step 6**: the frontier: after each merger report, start implementers (step 4) for every slice whose blockers are all `merged`, in the background, with at most `max_parallel_slices` building at once. A slice blocked by a red slice is red too: status `red`, its ticket commented with the blocker.
- **Step 7 is replaced**: every slice was reviewed on merge, so `code-review` does not run again. Write the PR body (section 3) instead.
- **Step 8**: GitHub: `gh pr ready`. Local: print `feat/<slug>` and the red slices.
- **Step 9**: worktrees of merged slices are already gone (the merger); red slices keep theirs for the next run.

Done when no slice is `open` or `building` and every implementer and merger has reported.

## 3. The PR body

`node "${CLAUDE_PLUGIN_ROOT}/bin/skill-path.mjs" pr` prints Matt's `pr` file; read its template and section guidance. Rewrite only the sections build owns, after `## Plan` in the order of `docs/contracts.md`, every other section verbatim, `## Flagged concerns` as spec wrote it (`gh pr view --json body`, edit, `gh pr edit --body-file`):

- `## Summary`, `## Evidence`, `## Merge Danger`: the `pr` template over `git diff <default>...feat/<slug>`. Evidence is one bullet per slice from its verify record: `<slug>-<nn>`, the proof command and its exit code, each host command and its exit code, `head`, `at`.
- `## Red slices`: one line per red slice, its ticket and reason (the merger's report or the blocker), or `none`.

Without a remote the same text goes into `docs/efforts/<slug>/PR.md`, committed on `feat/<slug>`. Done when the PR body (or PR.md) holds every section above.

## 4. Gate 4

Set the effort to `stage: built`, `gate: pr`, each slice's final status. Report: the PR link (or `feat/<slug>`), merged and red counts, and the red slices with their tickets. Stop: Gate 4 is the code owner's. Done when the state reads back `stage: built`, `gate: pr` and the report is printed.
