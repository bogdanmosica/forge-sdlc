# forge-sdlc

The [AI-native SDLC playbook](https://claude.com/resources/articles/the-ai-native-sdlc-playbook) as a team of Claude Code agents, with [Matt Pocock's skills](https://github.com/mattpocock/skills) as the procedures. One effort, one folder under `docs/efforts/<slug>/`, one pushed branch `feat/<slug>`, one PR. Humans decide at the gates; agents work between them; hooks enforce the rules a model could forget.

Matt's skills are used unmodified. forge-sdlc adds the frame: where each artifact is committed, who may edit what and when, which agent runs which step with which tools, and where the human is asked. Design: [docs/design.md](docs/design.md); diagrams: [docs/how-it-works.md](docs/how-it-works.md); shared names and schemas: [docs/contracts.md](docs/contracts.md); decisions: [docs/adr/](docs/adr/); words: [GLOSSARY.md](GLOSSARY.md).

## Install

```sh
claude plugin marketplace add <path or URL of this repository>
claude plugin install forge-sdlc@forge-personal --scope project
claude plugin install workbench@forge-personal --scope user   # optional, the cmux hooks, see Workbench below
```

`mattpocock-skills@claude-plugins-official` is a declared dependency. The CLI installs it with forge-sdlc, at the same scope, and the success line lists it (`+ 1 dependency: mattpocock-skills`). That works because this marketplace's `allowCrossMarketplaceDependenciesOn` names `claude-plugins-official`; without that allowlist the CLI skips a dependency from another marketplace and forge-sdlc fails to load. If the success line does not list the dependency, install it by hand at the same scope and the plugin loads on the next start:

```sh
claude plugin install mattpocock-skills@claude-plugins-official --scope project
```

The loop is tested against the version in [UPSTREAM.lock](plugins/forge-sdlc/UPSTREAM.lock); a session start warns when the installed one differs.

## Once per host

```text
/mattpocock-skills:setup-matt-pocock-skills   # tracker, triage labels, domain docs
/forge-sdlc:init                              # proof commands, formatter, branches, gates, risk → docs/agents/forge.md
```

`init` derives what the repo tells it, asks the rest, writes `docs/agents/forge.md` (the host config every skill and hook reads), adds a `### Delivery loop` block to CLAUDE.md, and gitignores `.forge/`. Edit `forge.md` by hand later; rerun `init` to rewrite it.

## The loop

Every command is user-invoked: type it with the `forge-sdlc:` prefix. `/forge-sdlc:wayfinder` is the front door: it starts an effort from an idea or `#issue`, and resumes one from its slug, running the next stage and stopping at that stage's gate. The other stage commands rerun one stage by hand.

| Stage | Command | Artifact committed on `feat/<slug>` | Agents | Gate (who decides) |
| --- | --- | --- | --- | --- |
| Plan | `/forge-sdlc:wayfinder <idea>` (`/forge-sdlc:intent <slug>` reshapes the Destination) | `map.md`, then `intent.md`; draft PR (or `PR.md`) | researcher, prototyper | 1: the owner accepts the intent, or the policy when nothing is open |
| Design | `/forge-sdlc:spec <slug>` | `spec.md` | spec-writer | 2: the owner approves, or the policy when nothing is open or flagged; the tech lead too when `risk: high` |
| Build 1 | `/forge-sdlc:plan <slug>` | `plan.md`, tickets on the tracker | none: the engineer is quizzed in the session | 3: the engineer approves the breakdown, or the policy answers the quiz with it |
| Build 2 + Test | `/forge-sdlc:build <slug>` | merged slices; PR ready with evidence and red slices | implementer, verifier, merger, reviewer ×3 | 4: the code owner reviews and merges |
| Test, by hand | `/forge-sdlc:slice-review <slice-branch> [effort-branch]` | `.forge/review/<slug>-<nn>.md` (not committed) | reviewer ×3, implementer, verifier | verdict `clean` or `red` |
| any | `/forge-sdlc:status [slug]` | none: read-only | none | none |
| any | `/forge-sdlc:help` | none: opens the `/forge` panel on the commands | none | none |

Who passes Gates 1 to 3 is the gate policy, `policy` under `## Gates` in `forge.md`. `attended`, the default, stops at every gate for its human, as the table reads. With `policy: autonomous`, one `/forge-sdlc:wayfinder <idea>` charts and works the map with you, then runs intent, spec, plan and build in the same run, printing each stage's report as its gate passes, and stops only on an `open:` assumption line, a flagged concern in the spec, `risk: high` (that effort then runs attended), or Gate 4, which stays the code owner's. The quiz's answers are recorded in `plan.md` and the PR body for review at Gate 4; a stopped effort resumes with `/forge-sdlc:wayfinder <slug>` to its next stop.

Build is unattended: each slice is built test-first in its own worktree, verified (`.forge/verify/<slug>-<nn>.json`), reviewed on three axes (Standards, Spec, Bugs and security), and merged `--no-ff` into `feat/<slug>` only when clean. Two fix rounds at most, then the slice is red: it stays local and is listed in the PR. Only `feat/<slug>` is ever pushed.

Every agent the loop starts is a named member, its name drawn from the crew theme `init` asks for. A lead launched with agent teams enabled (as `cmux claude-teams` does) is what makes the names visible: each member opens as a named pane, listed in cmux's Crew panel, and closes once its work is settled. A plain lead runs the same calls as subagents, and the names show only in the Gate 4 report.

## Hooks

Reminders for the agent, not a sandbox: the git host's branch protection stays the enforcement of record. State comes from `.forge/state.json`, `docs/agents/forge.md` and git, never from the conversation.

| Hook | Enforces | Active when |
| --- | --- | --- |
| protected-branch | no edit (Edit, Write, NotebookEdit) and no `git commit` on the default branch or `forge.md`'s protected globs | always; before `init`, on the default branch when git can tell it |
| slice-push | `git push` publishes only `feat/<slug>`; `--all`, `--mirror` and every other branch are refused | after `init`; before it, only `slice/*` pushes are refused |
| spec-frozen | no edit to an effort's `intent.md`, `spec.md`, `plan.md` | from the effort's `build` stage on |
| test-frozen | no edit to a file matching `forge.md`'s test globs | while the edited file's checkout is in fix mode (the slice's mode in its worktree, the effort's on `feat/<slug>`) |
| secrets-in-diff | no `git commit` that would add a credential shape or a `.env*` file: what is staged plus what the same command stages first (`git add … &&`, `commit -a`, `commit <path>`), simulated in a throwaway index; the reason names path and pattern, never the value | always |
| format-after-edit | runs `forge.md`'s formatter on each edited file | when `forge.md` names a formatter |
| verified-before-stop | an agent in a slice checkout stops only with a green verify record at its current HEAD; the reason is the command to run. After three blocks the next stop passes once, the slice marked red | on Stop and SubagentStop on a `slice/<slug>-<nn>` branch, and on a subagent's SubagentStop by the slice whose `agent` is its id |
| skills-version | warns when mattpocock-skills is missing, another version, or lost a heading the loop reads | at session start, resume and clear |

## Agents

| Agent | Model, effort | Tools | Role |
| --- | --- | --- | --- |
| researcher | Sonnet, medium | read, search, web, write | answers one research ticket or exploration brief from primary sources, under `docs/research/<slug>/` or `.forge/notes/<slug>/` |
| prototyper | Opus, high; own worktree | all but Agent | answers one design question with throwaway code; returns the verdict |
| spec-writer | Opus, high | read, search, write, Skill | synthesises `spec.md` from the intent, applies the policy skills, asks nothing |
| implementer | Opus, high | all but Agent and AskUserQuestion | builds one slice test-first, runs `verify-record.mjs` before it stops; fixes review findings |
| verifier | Sonnet, low | Bash, Read | runs `verify-record.mjs`, which writes the verify record; judges nothing |
| reviewer | Opus, high | read-only | reviews one axis of one slice's diff: Important blocks, Nit does not |
| merger | Sonnet, low | Bash, read, write, Skill, Agent | follows slice-review, merges a clean slice or marks it red |

## Run pane

`/forge-pane` opens the run pane (`plugins/forge-sdlc/hooks/run-pane.tsx`, the plugin's one hooks module): the frontier of the newest effort map under `docs/efforts/` (its open, unblocked, unclaimed tickets from `.scratch/<slug>/issues/`), the agents with their output tokens, where your context went, and an agents table with a list-price USD estimate (`prices.json`). It opens unasked on `/forge-sdlc:wayfinder` and `/forge-sdlc:build` from 144 columns. `/forge-pane history` lists the stored runs (per map and run, per-agent tokens, the effort's stage from `.forge/state.json`), `/forge-pane export` writes them as CSV under `.forge/`. The same figures sit in a band above the prompt: the mark, context, cost, the subscription windows, the running agents, and any problem in the host config. At its right, the **H** button (or `/handoff-new [focus]`) hands the conversation off: one fork over the transcript writes a handoff to `$TMPDIR` (else `~/.claude/handoffs`) with credential shapes redacted, then `/clear` starts a new conversation whose prompt box is drafted to read it. A mod cannot bind a key, so the button borrows the `app:cycleDiffBase` action: bind a chord to it in `~/.claude/keybindings.json` (Global context, e.g. `ctrl+x h`) and the button's tooltip names it.

`/forge` opens the help panel (`plugins/forge-sdlc/hooks/forge.tsx`, its tables in `forge/help.ts`): the plugin's commands, read from each skill's own `SKILL.md` when the panel opens and grouped as Loop, Setup and Tools with the mod's own commands, the **m** button listing `mattpocock-skills`' commands from the newest release in the install cache beside them; `/forge agents` the agents by subagent type with the model and effort each runs at; `/forge loop` the loop stage by stage with where you are needed, and the gate policy under it. `/forge-sdlc:help` opens it on the commands and asks the model only to point at it. Buttons c, a, l, m and x, Esc while it has the focus, `/forge close` from the prompt.

Two optional sections of `docs/agents/forge.md` feed it. `## Routing` routes a role to another model or effort (`- model.implementer: claude-opus-5-5`, `- effort.reviewer: high`; [plugins/forge-sdlc/hooks/ROUTING.md](plugins/forge-sdlc/hooks/ROUTING.md)): applied at spawn and on every step, the row marked `⇄ routed`, an invalid bullet toasted once and kept in the band. `## Mark` (`text`, `color`, a hex colour in quotes) replaces the `forge` word at the left of the band. The `## Crew` theme init writes also names any Agent call the lead left unnamed (a skill's own Explore or general-purpose agent) from the theme's `general` pool; the loop's member calls keep the name `bin/crew-name.mjs` gave them.

Ported from eMAG's `emag-sdlc` plugin on 2026-10-31 (0.3.0; the handoff button 0.4.0; the `/forge` help panel 0.5.0), without its GitLab merge-request gauge and Jira.

## Workbench

forge-sdlc also carries the workbench mod (`plugins/forge-sdlc/hooks/workbench.tsx`, registered from the run pane's module): every running Claude session at a glance inside Claude Code. `/focus-pane` shows this session (branch with its diff against the default branch, the Jira ticket the branch names, the MR from `glab` with a ready-to-merge checklist, context, prompt cache, cost and rate limits, the files edited); `/boards` lists every live session (board, lanes, inbox, agent teams) from the records each session keeps in `~/.cache/workbench/sessions/`; a needs-you band above the prompt names the sessions waiting on you; `/diff-pane`, `/side-chat`, `/morning` and `/crew` do the rest. The same mod ships in eMAG's `emag-sdlc` plugin, so a host with either plugin has it; the records are shared, so sessions under either see each other.

`plugins/workbench/` is a second, standalone plugin in this marketplace, unrelated to the loop: command hooks (`hooks/scripts/`) that feed the [cmux](https://github.com/manaflow-ai/cmux) sidebars (needs-you marker, lanes, task mirror, checkpoints, activity log, FILES line, team and crew sync) and stay silent outside cmux, and the `cmux-crew` skill, which runs a visible team of sessions, one cmux pane per member. It is installed at user scope so the hooks run in any project's session. It moved here from the eMAG `agent-pipeline` repository on 2026-10-29 at version 0.5.1; its mod moved into forge-sdlc and emag-sdlc the same day (0.6.0).

## Developing

```sh
npm test            # node:test: hooks, bin scripts, skills and agents structure, manifests, eval suite integrity; then claude plugin test: the workbench mod
npm run typecheck   # the workbench mod against the engine's declarations
npm run validate    # claude plugin validate --strict, marketplace and plugins
npm run check       # all three
```

Set `MATTPOCOCK_SKILLS_ROOT=<a mattpocock-skills plugin root>` when running `npm test` so the tests that compare against the upstream files, and the upstream eval scaffolds, run instead of skipping. The bin scripts are documented in [CLAUDE.md](CLAUDE.md).

## Evals

`claude plugin eval` suites under [plugins/forge-sdlc/evals/](plugins/forge-sdlc/evals/), one folder per case (`case.yaml`, `fixture.sh`, `graders/`):

| Suite | Cases | Checks |
| --- | --- | --- |
| `triggering` | one `<command>-fires` per command, and `init-builtin-quiet`, `wayfinder-neighbour-quiet`, `slice-review-neighbour-quiet` | each command runs its first step from its slash line, and the neighbours' phrasing (built-in `/init`, plain words about mapping an idea or reviewing a diff) leaves it unrun |
| `guardrails` | one per hook, plus a case for `test-frozen` and `spec-frozen` run by a session whose project dir is a slice worktree | the hook fires on a fixture host and the run shows its decision; `seam.json` is the same payload, run by `npm test` with no model call, its optional `projectDir` (a slice worktree under the workspace) standing for a session whose project dir is a slice worktree |
| `frame` | `build-three-slices` | `/forge-sdlc:build` on the three-ticket fixture effort (`evals/fixtures/word-count/`) ends at Gate 4 with the PR body sections, no question asked, every slice reviewed clean before merging |
| `upstream` | `upstream-check-ok` | `skill-path.mjs --check` is ok on the installed mattpocock-skills (the scaffold fails otherwise) and no drift warning reaches the session |

Run from the repository root. The target comes first, and `--allow-tools` comes last because it takes every word after it:

```sh
# free: loads every case and stops before the first run
claude plugin eval plugins/forge-sdlc --trust-plugin --no-publish --ablation none --max-cost-usd 0 --allow-tools Bash Write Edit

# triggering, guardrails, upstream
claude plugin eval plugins/forge-sdlc --trust-plugin --scaffold --no-publish --model claude-sonnet-5-5 \
  --max-cost-usd 5 --tag triggering guardrails upstream --allow-tools Bash Write Edit

# frame: one long unattended build
claude plugin eval plugins/forge-sdlc --trust-plugin --scaffold --no-publish --model claude-sonnet-5-5 \
  --ablation none --max-cost-usd 30 --tag frame --allow-tools Bash Write Edit
```

- `--scaffold` runs each case's `fixture.sh`, which builds the fixture host in the run's workspace. They are this repository's scripts, so trust them as you trust the plugin.
- The `upstream` and `frame` scaffolds copy your installed mattpocock-skills into the workspace and register it for `bin/skill-path.mjs`. Without that install they fail on purpose. Matt's model-invoked skills (`tdd`, `code-review`) are not loaded in a run, because the runner loads only plugins under its target.
- On macOS the eval sandbox can break `git` for the agent's own Bash calls. The guardrail hooks decide before git runs, so they are unaffected. Run `frame` on Linux if its git steps fail.
- Results go to `plugins/forge-sdlc/evals/results/` (gitignored). Rerun the suites after every change to a skill, agent or hook, and after a bump of `UPSTREAM.lock`. Every incident adds a case.
