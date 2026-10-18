#!/usr/bin/env bash
# The fixture effort at Gate 3 on feat/word-count, local tracker, no remote (the gate record is PR.md), the upstream registered.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
branch feat/word-count
effort
commit "word-count: map, intent, spec, plan"
state plan plan
upstream
