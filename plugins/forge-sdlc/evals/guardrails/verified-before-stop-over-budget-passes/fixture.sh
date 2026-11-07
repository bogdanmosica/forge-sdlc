#!/usr/bin/env bash
# As verified-before-stop-agent-blocks (feat/word-count at stage build, slice word-count-01's agent
# recorded, no verify record), with a Budgets section of 1000 tokens and a synthetic transcript under
# .transcripts/ whose last usage is past it: the stopping subagent is over its context budget.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
printf '\n## Budgets\n- agent_context: 1000\n' >> docs/agents/forge.md
branch feat/word-count
effort
commit "word-count: artifacts"
state build none
worktree 01
node -e 'const fs = require("fs"), [f, slice, agent] = process.argv.slice(1);
  const s = JSON.parse(fs.readFileSync(f, "utf8"));
  s.efforts["word-count"].slices[slice].agent = agent;
  fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");' .forge/state.json word-count-01 a4e1c07b92d35
mkdir -p .transcripts/sess-eval/subagents
printf '{"type":"user","message":{"content":"go"}}\n' > .transcripts/sess-eval.jsonl
printf '{"type":"assistant","message":{"usage":{"input_tokens":3,"cache_read_input_tokens":12000,"cache_creation_input_tokens":400}}}\n' \
  > .transcripts/sess-eval/subagents/agent-a4e1c07b92d35.jsonl
