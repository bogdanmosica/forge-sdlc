#!/usr/bin/env bash
# feat/word-count at stage build with slice word-count-01's worktree, whose agent the lead recorded
# in .forge/state.json; no .forge/verify record. The host stays on the effort branch: a subagent's
# SubagentStop carries the lead's root as cwd, never the worktree it cd-ed into.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
branch feat/word-count
effort
commit "word-count: artifacts"
state build none
worktree 01
node -e 'const fs = require("fs"), [f, slice, agent] = process.argv.slice(1);
  const s = JSON.parse(fs.readFileSync(f, "utf8"));
  s.efforts["word-count"].slices[slice].agent = agent;
  fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");' .forge/state.json word-count-01 a4e1c07b92d35
