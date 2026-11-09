# 21. A host may be a subfolder of its repository

Status: accepted, 2026-11-09

## Context

A monorepo keeps one forge host per project: `projects/<x>/docs/agents/forge.md`, the session launched in `projects/<x>`, the skills writing `.forge/state.json` there and cutting slice worktrees under `projects/<x>/.forge/worktrees/`, each a checkout of the whole repository. The hooks found the host through git instead, as the parent of the git common dir (the decision under ADR 0007), which in a monorepo is the repository root: `spec-frozen` and `test-frozen` read a state file that does not exist there and allowed every edit, `verified-before-stop` looked for verify records and named `--project` at the root, and `test-frozen` matched the host's test globs against paths from the root (`projects/<x>/tests/...` is not `tests/**`). `effort-state.mjs` read `PR.md` with a root-relative `git show` path, so a subfolder effort with a ready PR read as `plan`.

## Decision

`hostDirOf` resolves the host of a path as:

- in a slice worktree, a checkout at `<host>/.forge/worktrees/<slice>`: that `<host>`, wherever in the worktree the path is;
- elsewhere: the folder of the main checkout at the same place as the path, then up to the nearest one holding `docs/agents/forge.md`, else the main checkout.

`verified-before-stop` takes its project from `hostDirOf`; `test-frozen` matches the globs relative to the host as checked out in the edited file's checkout (`hostInCheckout`), and from the checkout root for a file outside the host; `effort-state.mjs` reads `PR.md` with a `./` path, relative to the host.

## Consequences

- A single-repo host resolves exactly as before: its forge.md sits at the main checkout, and its slice worktrees under its own `.forge/worktrees/` (`tests/subfolder-host.test.mjs` holds both shapes).
- A session launched at the repository root of a monorepo still finds no host config; the host is the project folder, so forge runs from there.
- A path in a nested folder with its own `docs/agents/forge.md` resolves to that folder: one host per folder, the nearest wins.
