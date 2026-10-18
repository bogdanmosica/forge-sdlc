#!/usr/bin/env bash
# The fixture effort on feat/word-count, state at stage build.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
branch feat/word-count
effort
commit "word-count: artifacts"
state build none
