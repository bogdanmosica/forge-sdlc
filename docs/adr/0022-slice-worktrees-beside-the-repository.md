# 22. Slice worktrees live beside the repository and get a real install

Status: accepted, 2026-11-10; amends [ADR 0021](0021-a-host-may-be-a-subfolder.md)

## Context

Slice worktrees were cut under the host, `<host>/.forge/worktrees/<slug>-<nn>`, with the host's `dependency_dir` (forge.md `## Worktrees`, default whichever of `node_modules`, `.venv`, `vendor` exists) symlinked in from the host. The effort shop-cart, built in the monorepo's `projects/furniture-shop` on 2026-11-10, hit four problems with that shape:

- **Skills listed once per worktree.** Claude Code discovers skills upward to the repository root and also inside nested checkouts, so every repo skill was listed again scoped to each worktree (`projects/furniture-shop/.forge/worktrees/shop-cart-01:<skill>`, ... `-04:<skill>`): four copies of the whole shared skill set in every session's skill list, for as long as the worktrees lived.
- **pnpm refused to run in the worktree.** pnpm 12 stopped `pnpm --filter … exec` with `ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH` when the worktree's root `node_modules` was a symlink to the main checkout's.
- **Turbopack could not resolve Next.** Turbopack could not resolve `next/package.json` through a `node_modules` symlink pointing outside the worktree root.
- **A real install is cheap.** With pnpm's content-addressed store warm, `pnpm install --frozen-lockfile --prefer-offline` in a fresh worktree took about 2 to 7 seconds per slice, so the symlink saved nothing worth its breakage.

## Decision

- A slice worktree lives outside the repository, beside its main checkout: `<parent of main checkout>/<main checkout folder>-worktrees/<slug>-<nn>` (`sliceWorktreeDir` in `hooks/scripts/lib.mjs`). `bin/slice-worktree.mjs <slug>-<nn> [--project <host>] [--add]` prints that path, and with `--add` cuts it on `slice/<slug>-<nn>` from the tip of `feat/<slug>` (reusing an existing branch or worktree) and runs the install. The build skill, the merger, slice-review and the implementer take the path it prints; status finds worktrees by their `slice/<slug>-` branch in `git worktree list --porcelain`, never by path.
- Its host is resolved through git (`hostDirOf`), in order: (1) the path mapped onto the main checkout, then up to the nearest folder holding `docs/agents/forge.md`; (2) in a linked worktree, among the folders holding a `docs/agents/forge.md` that `git ls-files` lists, the one whose `.forge/state.json` holds the slice the worktree's branch names; (3) the pre-0.7.0 `<host>/.forge/worktrees/<slice>` shape; (4) the main checkout. The `git ls-files` search only runs when step 1 fails: a single-repo host, or any path inside the host's folder of a worktree, resolves in step 1 without it.
- No `worktree` field is stored in `.forge/state.json`. The path is a function of the repository and the slice, and the slice's host is found from its branch, so a stored path could only go stale (a moved checkout, a renamed folder) and would need a migration for every existing state file.
- `## Worktrees` takes `install: <command>`, run with `/bin/sh` at the new worktree's root; `none` or no key means no install. `dependency_dir` is no longer read: a value other than `none` is a config problem (`DEPENDENCY_DIR_PROBLEM`, shown on the band), and `slice-worktree.mjs --add` refuses to cut a worktree for a host that names one with no `install`, rather than leave it without dependencies.

## Consequences

- The skill list holds one copy of each skill again; a slice worktree is outside the folder Claude Code scans.
- Each slice pays one install (seconds with a warm store) and holds its own `node_modules`, so pnpm, Turbopack and any tool that resolves relative to its root work as in the main checkout.
- A host that set `dependency_dir` sees the problem on the band and in `slice-worktree.mjs` until it adds `install` (init writes it on a re-run).
- Worktrees cut before 0.7.0 under `.forge/worktrees/` still resolve to their host and still gate the stop (`verified-before-stop` looks at `sliceWorktreeDir`, then the old path), so an effort in flight finishes without being re-cut.
- The `<repo>-worktrees/` folder sits next to the repository on disk, outside any git ignore; the merger removes a merged slice's worktree, and red slices keep theirs there.
