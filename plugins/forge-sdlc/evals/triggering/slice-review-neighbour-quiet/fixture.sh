#!/usr/bin/env bash
# The same slice branch as slice-review-fires.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
branch feat/word-count
branch slice/word-count-01
printf "export const countLines = (text) => text.split(\"\\n\").length;\n" > src/lines.mjs
commit "word-count-01: count lines"
