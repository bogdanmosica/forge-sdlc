#!/usr/bin/env bash
# The installed upstream registered in the run; upstream exits non-zero unless skill-path.mjs --check is ok.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
upstream
