# Glossary

The leading words of forge-sdlc, one line each. The design ([docs/design.md](docs/design.md)) uses them as defined here; the shapes behind them are in [docs/contracts.md](docs/contracts.md).

- **effort**: one piece of work from idea to merged PR, named by its `<slug>`, with one folder `docs/efforts/<slug>/`, one effort branch and one PR.
- **lead**: whoever starts members and waits for their reports: the session running a forge-sdlc command, which dispatches the agents of a stage, and the merger, which starts the members slice-review calls for (its reviewers, the fix implementer and the verifier).
- **member**: an agent a lead starts with a name from the host's crew theme; under a lead with agent teams enabled it runs as a teammate in a visible pane, elsewhere as the subagent it always was. Same brief, same worktree, same proof either way.
- **crew theme**: the host's choice of names for its members, one pool per role, picked at init; display only, never a branch, commit or record name.
- **map**: the wayfinder map of an effort, `docs/efforts/<slug>/map.md`: its Destination, notes, decisions so far, and the tickets (on the tracker) still to resolve before the way is clear.
- **Destination**: where the effort is going, written under the intent headings Problem, Outcome, Users, Constraints, Open questions; named first, it becomes `intent.md`.
- **slice**: one tracer-bullet ticket of the plan, `<slug>-<nn>`, built test-first on its own local branch `slice/<slug>-<nn>` in its own worktree, then merged into the effort branch.
- **frontier**: the open tickets whose blockers are all closed (or merged): what can start now.
- **gate**: a point where a human decides (Gate 1 intent, 2 spec, 3 plan, 4 PR); the effort waits there in `.forge/state.json`, and the PR body or `PR.md` is the gate record.
- **proof**: the one command and observable that show a slice done, written in `plan.md` and run first by `verify-record.mjs`; the host's proof commands (test, typecheck, lint, build) follow it.
- **verify record**: `.forge/verify/<slug>-<nn>.json`, written by `bin/verify-record.mjs`: each command, its exit code, a trimmed tail, the HEAD it ran at; fresh while HEAD is unchanged, green when every command exited 0.
- **review record**: `.forge/review/<slug>-<nn>.md`, written by slice-review: each round's three axis reports side by side, then the verdict.
- **red**: a slice that failed its verdict or its verify record after two fix rounds (or is blocked by a red slice): never merged, never pushed, listed under `## Red slices`, its worktree kept.
- **clean**: the verdict of a slice whose last review round has no Important finding and whose verify record is fresh and green; only a clean slice merges.
- **effort branch**: `feat/<slug>`, the only branch an effort pushes; every artifact, research note and slice merge lands on it, and a human merges it.
- **assumption line**: one bullet under `## Assumptions to confirm`, either `recommended: <reading taken> (source: ...)`, which lets the stage continue, or `open: <question>`, which only the owner settles.
- **policy skill**: a host skill named in `forge.md` (`## Policy skills`) that the spec-writer and the reviewer apply by name; what it cannot resolve becomes a flagged concern.
- **tripwire**: the upstream drift check, `UPSTREAM.lock` read by the `skills-version` hook and `skill-path.mjs --check`: a missing, changed or broken mattpocock-skills warns instead of silently misreading.
- **host config**: `docs/agents/forge.md`, written by `/forge-sdlc:init`, one `- key: value` bullet per line under a `## Section`: proof commands, formatter, branches, worktrees, gates, risk globs, policy skills, test globs.
