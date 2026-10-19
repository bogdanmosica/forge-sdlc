---
name: wayfinder
description: The front door of the forge-sdlc loop. Start an effort from an idea or a tracker issue by charting and working a wayfinder map on feat/<slug>, then write intent.md and open the draft PR (Gate 1); resume an effort by its slug.
disable-model-invocation: true
argument-hint: "<idea> | #issue | <slug>"
---

`/forge-sdlc:wayfinder` is Plan: an idea becomes a **map**, the map's tickets are worked until the way is clear, and the clear way is committed as `intent.md` for the owner's Gate 1. The procedure is Matt's `wayfinder`, read by file; this skill is the frame: where the map lives, who resolves each ticket, what Gate 1 receives.

## 1. Resolve the input

- A slug: `node "${CLAUDE_PLUGIN_ROOT}/bin/effort-state.mjs" . <slug>` exits 0 for an existing effort: go to [Resume](#resume). Exit 1 means no such effort: the words are an idea.
- `#123`: fetch the issue as `docs/agents/issue-tracker.md` says; its title and body are the idea. Words: they are the idea.
- `node "${CLAUDE_PLUGIN_ROOT}/bin/forge-config.mjs"` prints the host config; exit 1 stops with its line (run `/forge-sdlc:init`). Keep the default branch, the `risk.high` globs and `gates.policy` (`autonomous` when it reads exactly that, else `attended`).
- `node "${CLAUDE_PLUGIN_ROOT}/bin/skill-path.mjs" wayfinder` prints the procedure's file; read it whole. Exit 1 stops with the install line it printed.

Done when the idea is in hand, the config printed and the upstream file read.

## 2. Name the Destination

Upstream's `Chart the map` step 1, through `mattpocock-skills:grilling` and `mattpocock-skills:domain-modeling`: the human answers every question themselves. The **Destination** is written under the playbook's intent headings, so it becomes the intent later without a rewrite:

```markdown
## Destination

### Problem
### Outcome
### Users
### Constraints
### Open questions
```

Derive `<slug>` (kebab-case) from the map title. Done when the human confirms the Destination and the slug.

## 3. Chart the map on feat/<slug>

Upstream's `Chart the map` steps 2–5, with these frame rules in place of its own:

- **The map body is a file.** `git switch -c feat/<slug> <default branch>`, then write `docs/efforts/<slug>/map.md`: artifact frontmatter (`effort`, `stage: map`, `status: draft`, `risk: normal`, `updated`), then upstream's map body with the Destination above. Commit it alone as the effort's first commit: `map(<slug>): chart`.
- **Tickets live on the tracker**, per `docs/agents/issue-tracker.md` ("Wayfinding operations"): the map issue labelled `wayfinder:map` holds a link to `docs/efforts/<slug>/map.md` and a one-line gist, never the body. Each ticket is a child with its `wayfinder:<type>` label and native blocking edges.
- **No fog is a small effort**: a map with a Destination and no tickets. Continue at step 5.
- **Research findings** commit on `feat/<slug>` under `docs/research/<slug>/`, in place of upstream's throwaway branch.
- State: `stage: map`, `gate: none` (as in step 6).

Done when `git log --oneline feat/<slug>` shows the map commit first and every specifiable ticket is on the tracker.

## 4. Work the map

Upstream's `Work through the map`, in this session, ticket after ticket, until the frontier is empty; the frame lifts its per-session ticket limit. An agent below is a [member call](../build/MEMBERS.md) and this session its lead: read that file by path, which keeps its plugin-root variable unresolved, and Bash has no such variable: read each one in it as `${CLAUDE_PLUGIN_ROOT}`. Who resolves each type:

| Label | Resolved by | How |
| --- | --- | --- |
| `wayfinder:grilling` | this session, HITL | `mattpocock-skills:grilling` then `mattpocock-skills:domain-modeling`; the human answers, the agent asks |
| `wayfinder:research` | `forge-sdlc:researcher`, a [member call](../build/MEMBERS.md), role `researcher`, in the background, all at once | prompt: the ticket pointer, the slug, the note path `docs/research/<slug>/<topic>.md` |
| `wayfinder:prototype` | `forge-sdlc:prototyper`, a [member call](../build/MEMBERS.md), role `prototyper`, foreground under a plain lead, that passes `isolation: "worktree"` on the call, so it runs in its own worktree under any lead; one at a time | prompt: the ticket pointer and its question; the human reacts to the verdict before the ticket closes |
| `wayfinder:task` | this session | done by the agent where it can, else a checklist the human works |

Each resolution: the answer on the ticket, the ticket closed, its gist in the map's Decisions so far, fog graduated per upstream. Then re-commit `map.md` (and any research note): `map(<slug>): <ticket name>`.

Done when the tracker's frontier query for the map returns no open ticket and every resolution is committed.

## 5. Write intent.md

`docs/efforts/<slug>/intent.md` from [INTENT-TEMPLATE.md](INTENT-TEMPLATE.md): the Destination's five headings brought up to date, Decisions so far and Out of scope from the map, and every gap an assumption line per [ASSUMPTIONS.md](ASSUMPTIONS.md).

Risk: `risk: high` when any path the decisions name as touched matches a `risk.high` glob from step 1, else `risk: normal`; a path in doubt is high, with a `recommended:` line saying so. The same value goes into map.md's frontmatter.

Done when every template heading has content or `none`, and every gap is an assumption line.

## 6. Commit, draft PR, state

- Commit `docs/efforts/<slug>/intent.md` and `map.md` on `feat/<slug>`: `intent(<slug>): <title>`.
- With an origin: `git push -u origin feat/<slug>`, then `gh pr create --draft --base <default branch> --head feat/<slug> --title "<title>" --body-file <file>`. The body leads with `## Intent` (the five intent headings, from intent.md) and `## Assumptions to confirm` (the lines, `open` first). Without a remote, the same body is `docs/efforts/<slug>/PR.md`, committed on `feat/<slug>`.
- State: with `readState` and `writeState` from `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/lib.mjs` (`node --input-type=module -e`), set `.forge/state.json`'s effort to:

```json
{ "stage": "intent", "gate": "intent", "mode": "normal", "risk": "<risk>", "branch": "feat/<slug>", "pr": { "number": 12, "url": "<url>" }, "slices": {}, "updatedAt": "<now>" }
```

  `pr` is `null` without a remote.

Done when the PR (or PR.md) shows both sections and `.forge/state.json` reads back `gate: intent`.

## 7. Gate 1

Apply the [gate policy](GATE-POLICY.md) to intent.md. Report in four lines: the intent path, the PR URL (or PR.md), the `open:` assumptions verbatim (or none), and the gate line by policy:

- `attended`: the next move: the owner reads intent.md, comments or edits it, then runs `/forge-sdlc:wayfinder <slug>`; this run ends here.
- `autonomous`, passed: `Gate 1 passed: policy autonomous, nothing open`, then continue as [Resume](#resume) step 3 with `spec` as next, in this run.
- `autonomous`, stopped: write `stop: <reason>` to the effort as step 6 writes state; the gate line names all the reasons and `/forge-sdlc:wayfinder <slug>`, and for `risk-high` says the effort runs attended from here; this run ends here.

Done when the report is printed and the run has ended at Gate 1 or gone on into `spec`.

## Resume

The slug runs the effort's next stage and stops at that stage's gate; the human typing the command is the approval of the gate the effort waits at.

1. **Where it stands.** The `effort-state.mjs` line of step 1 printed `{ slug, stage, gate, next, why, source }`. Announce `<slug>: stage <stage>, gate <gate>; next <next> (<why>)` and `git switch feat/<slug>`. `source: artifacts` means the state was lost: write the effort's `stage`, `gate`, `branch`, `pr` as step 6 does. Done when the line is printed and `.forge/state.json` reads back that stage.
2. **Reopened questions.** Read the `open:` lines under `## Assumptions to confirm` and what the owner wrote since: `gh pr view feat/<slug> --json body,comments`, or `docs/efforts/<slug>/PR.md` and `git log -p` on the effort folder. Each line the owner has settled by a comment or an edit reopens its map ticket (the one its question came from, else a new `wayfinder:grilling` ticket) and is worked as step 4 works one. Then the stage that wrote the line runs again: an intent.md line through steps 5–6, a spec.md line by taking `spec` as next. Done when every settled line is closed on the tracker and reads `recommended:` in its artifact.
3. **Run the next stage.** `map`: step 4 of this skill through step 7. `spec`, `plan`, `build`: the skill `forge-sdlc:<next>` with the slug; forge-sdlc commands are user-invoked, so read `${CLAUDE_PLUGIN_ROOT}/skills/<next>/SKILL.md` and follow it. A file read this way keeps its plugin-root variable unresolved, and Bash has no such variable: read each one in it as `${CLAUDE_PLUGIN_ROOT}`. `none`: report that the PR waits at Gate 4 for the code owner. After `spec`, a report of `Gate 2 passed` continues into `plan` in this run. Done when the stage's own report is printed and the run stops at its gate.
