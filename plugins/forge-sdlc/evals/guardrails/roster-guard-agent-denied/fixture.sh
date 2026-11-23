#!/usr/bin/env bash
# A configured host on main with a roster under enforcement: docs/agents/forge.yaml sets
# enforce: true and allows no built-in agent, so an Explore call is outside the roster.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
printf 'version: 1\nenforce: true\nallow:\n  agents: []\n  skills: []\n' > docs/agents/forge.yaml
commit "forge config and roster"
