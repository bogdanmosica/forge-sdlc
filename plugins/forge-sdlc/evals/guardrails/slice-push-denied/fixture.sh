#!/usr/bin/env bash
# A configured host on slice/word-count-01 with a local origin.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
local_origin
branch feat/word-count
branch slice/word-count-01
