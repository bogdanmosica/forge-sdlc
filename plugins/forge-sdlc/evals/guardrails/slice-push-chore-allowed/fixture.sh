#!/usr/bin/env bash
# A configured host on chore/tidy-readme, a branch outside any effort, with a local origin.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
local_origin
branch chore/tidy-readme
