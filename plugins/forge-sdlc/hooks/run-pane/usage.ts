// Per-agent token aggregation from `turn.step` usage, keyed by agent id ('main'
// for the main session), read by the agent table, the band and the run history.
import type { TurnUsage } from 'claude-code';
import type { AgentUsage } from '../types';

export const MAIN = 'main';

export function addStep(
  all: Record<string, AgentUsage>,
  agentId: string | undefined,
  usage: TurnUsage,
): Record<string, AgentUsage> {
  const id = agentId ?? MAIN;
  const before = all[id] ?? { model: usage.model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, steps: 0 };
  return {
    ...all,
    [id]: {
      model: usage.model || before.model,
      input: before.input + (usage.input_tokens ?? 0),
      output: before.output + (usage.output_tokens ?? 0),
      cacheRead: before.cacheRead + (usage.cache_read_input_tokens ?? 0),
      cacheWrite: before.cacheWrite + (usage.cache_creation_input_tokens ?? 0),
      steps: before.steps + 1,
    },
  };
}

// A token count drawn short: 950, 1.2k, 12k.
export const compactTokens = (n: number): string => {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
};
