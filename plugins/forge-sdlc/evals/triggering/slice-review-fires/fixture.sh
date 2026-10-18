#!/usr/bin/env bash
# slice/word-count-01 one commit ahead of feat/word-count; the upstream is not registered.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
commit "forge config"
branch feat/word-count
branch slice/word-count-01
printf "export const countLines = (text) => text.split(\"\\n\").length;\n" > src/lines.mjs
commit "word-count-01: count lines"
