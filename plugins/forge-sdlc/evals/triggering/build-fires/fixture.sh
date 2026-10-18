#!/usr/bin/env bash
# A configured host on main with no effort: the precondition fails.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
