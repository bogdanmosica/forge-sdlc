#!/usr/bin/env bash
# feat/word-count at stage build with slice word-count-01's worktree in fix mode; tests/** is the
# test glob. The seam runs the hook for a session whose project dir is a slice worktree.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
branch feat/word-count
effort
commit "word-count: artifacts"
state build none
worktree 01 fix
