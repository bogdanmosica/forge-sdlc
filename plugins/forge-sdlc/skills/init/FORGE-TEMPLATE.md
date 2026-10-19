# forge-sdlc host config

Read by every forge-sdlc skill and hook. One `- key: value` bullet per line under a `## Section`; a trailing `# comment` is ignored. Rewritten whole by `/forge-sdlc:init`, which keeps any `- names.<role>: <name>, ...` bullet under `## Crew` while the theme stays.

## Proof commands
- test: <command that exits non-zero on a failing test>
- typecheck: <command, or none>
- lint: <command, or none>
- build: <command, or none>

## Formatter
- command: <formatter command taking a file path, or none>

## Branches
- default: <default branch>
- protected: <default branch>, <other globs>   # release/*
- effort: feat/<slug>            # the only branch that is pushed
- slice: slice/<slug>-<nn>       # local, one worktree each, never pushed

## Worktrees
- dependency_dir: <node_modules | .venv | vendor | none>   # symlinked into each slice worktree, never installed there

## Gates
- policy: attended               # or: autonomous
- spec: always                   # or: only-on-open
- max_parallel_slices: 3

## Risk
- high: <globs, or none>         # src/auth/**, src/payments/**, migrations/**

## Policy skills
- skills: <skill names, or none> # applied by the spec-writer and the reviewer

## Test file globs
- globs: <globs>                 # **/*.test.*, **/*.spec.*, tests/**

## Crew
- theme: none                    # a preset id (warcraft, star-trek, star-wars, got, mario), none, or free text
