#!/usr/bin/env bash
# A configured host; the run's config dir has no plugin registry, so the upstream is missing.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
