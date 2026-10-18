#!/usr/bin/env bash
# A configured host on main; the upstream is not registered, so step 1 stops.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
