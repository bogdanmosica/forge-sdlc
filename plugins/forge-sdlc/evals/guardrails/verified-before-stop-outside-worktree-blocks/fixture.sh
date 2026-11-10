#!/usr/bin/env bash
# A monorepo whose forge host is projects/word-count (ADR 0021), on feat/word-count at stage build,
# with slice word-count-01's worktree cut beside the repository (ADR 0022); no .forge/verify record.
# The seam runs the hook for a session whose project dir and cwd are the worktree's root, where no
# forge.md sits: the 2026-11-10 shop-cart incident's shape.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
mkdir -p projects/word-count
cd projects/word-count
tracker
config
branch feat/word-count
effort
commit "word-count: host in projects/word-count"
state build none
worktree 01
