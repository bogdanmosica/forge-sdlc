#!/usr/bin/env bash
# feat/word-count with the effort in fix mode; tests/** is the test glob.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
branch feat/word-count
effort
commit "word-count: artifacts"
state build none fix
