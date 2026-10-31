#!/usr/bin/env bash
# A configured host on main with no effort.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
