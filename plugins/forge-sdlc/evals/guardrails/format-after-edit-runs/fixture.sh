#!/usr/bin/env bash
# feat/word-count with a formatter that stamps a header line on the file it is given.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
mkdir -p scripts
cat > scripts/fmt.mjs <<'JS'
import { readFileSync, writeFileSync } from "node:fs";
const file = process.argv[2];
const text = readFileSync(file, "utf8");
const HEADER = "// formatted by scripts/fmt.mjs\n";
if (!text.startsWith(HEADER)) writeFileSync(file, HEADER + text);
JS
config "node scripts/fmt.mjs <file>"
commit "forge config"
branch feat/word-count
