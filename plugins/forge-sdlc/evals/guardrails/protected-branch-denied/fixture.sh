#!/usr/bin/env bash
# A configured host checked out on main.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
