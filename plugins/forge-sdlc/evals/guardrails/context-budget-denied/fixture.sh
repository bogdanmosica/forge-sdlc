#!/usr/bin/env bash
# A configured host on main whose Budgets section sets agent_context to 1000, so any subagent with a
# turn behind it is over budget. The seam's payload reads a synthetic subagent transcript laid
# under .transcripts/, at the path the hook derives from transcript_path, session_id and agent_id.
source "$(dirname "${BASH_SOURCE[0]}")/../../lib/host.sh"
repo
tracker
config
printf '\n## Budgets\n- agent_context: 1000\n' >> docs/agents/forge.md
commit "forge config"
mkdir -p .transcripts/sess-eval/subagents
printf '{"type":"user","message":{"content":"go"}}\n' > .transcripts/sess-eval.jsonl
printf '{"type":"assistant","message":{"usage":{"input_tokens":3,"cache_read_input_tokens":12000,"cache_creation_input_tokens":400}}}\n' \
  > .transcripts/sess-eval/subagents/agent-a1b2c3.jsonl
