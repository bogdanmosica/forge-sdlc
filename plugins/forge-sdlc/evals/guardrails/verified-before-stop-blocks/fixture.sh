#!/usr/bin/env bash
# A configured host checked out on slice/word-count-01, no .forge/verify record.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
branch feat/word-count
branch slice/word-count-01
