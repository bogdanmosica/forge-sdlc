# forge-sdlc host config

Read by every forge-sdlc skill and hook. One `- key: value` bullet per line under a `## Section`; a trailing `# comment` is ignored. Rewritten whole by `/forge-sdlc:init`.

## Proof commands
- test: npm test
- typecheck: none
- lint: none
- build: none

## Formatter
- command: none

## Branches
- default: main
- protected: main
- effort: feat/<slug>            # the only branch that is pushed
- slice: slice/<slug>-<nn>       # local, one worktree each, never pushed

## Worktrees
- dependency_dir: none   # symlinked into each slice worktree, never installed there

## Gates
- spec: always                   # or: only-on-open
- max_parallel_slices: 3

## Risk
- high: plugins/forge-sdlc/hooks/**, plugins/forge-sdlc/.claude-plugin/**, .claude-plugin/**

## Policy skills
- skills: writing-for-agents # applied by the spec-writer and the reviewer

## Test file globs
- globs: tests/**
