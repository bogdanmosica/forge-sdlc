#!/usr/bin/env node
// Budget: a subagent's context. PreToolUse on every tool: deny the call once the subagent's
// context has reached the host's `## Budgets` `agent_context` (default 150000 tokens), so it
// writes its report and the lead dispatches a fresh member for the rest. Only a subagent's call
// carries `agent_id`; the main session is never blocked. The context is read from the tail of
// the subagent's transcript, which can lag a turn: fine for a budget. A missing or unparsable
// transcript lets the call through: a budget, not a guardrail.

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { allow, deny, run } from './lib.mjs';

export const DEFAULT_AGENT_CONTEXT = 150_000;

/** The calls an over-budget subagent still needs: handing its report back. Denying them would strand it. */
export const HANDBACK_TOOLS = new Set(['SubagentHandback', 'SendMessage']);

/** How much of the transcript's end is read: the last usage line sits well inside it. */
export const TAIL_BYTES = 256 * 1024;

/** The subagent's transcript, `<dir of the main transcript>/<session_id>/subagents/agent-<agent_id>.jsonl`; null without those fields. */
export function subagentTranscriptPath({ transcript_path: main, session_id: session, agent_id: agent }) {
  if (!main || !session || !agent) return null;
  return path.join(path.dirname(main), session, 'subagents', `agent-${agent}.jsonl`);
}

/** The context size of the last transcript line carrying `message.usage`: input + cache read + cache creation; null when none does. */
export function contextSizeOf(text) {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let usage;
    try {
      usage = JSON.parse(lines[i])?.message?.usage;
    } catch {
      continue; // a partial first line of the tail, or a line still being written
    }
    if (!usage) continue;
    const n = (v) => (Number.isFinite(v) ? v : 0);
    return n(usage.input_tokens) + n(usage.cache_read_input_tokens) + n(usage.cache_creation_input_tokens);
  }
  return null;
}

/** The host's `## Budgets` `agent_context` when it is a positive number, else the default. */
export function budgetOf(config) {
  const budget = Number(config?.budgets?.agent_context);
  return Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_AGENT_CONTEXT;
}

/** Deny at or over the budget; an unknown size passes. */
export function decide({ size, budget }) {
  if (size === null || size < budget) return allow();
  return deny(
    `Context budget ${Math.round(budget / 1000)}k reached: stop calling tools, write your report now: ` +
      `what is done, what is left, and where (files, commits), so the lead can dispatch the rest.`,
  );
}

/** The last `bytes` of `file` as text, or null when it cannot be read. */
function readTail(file, bytes = TAIL_BYTES) {
  let fd;
  try {
    fd = openSync(file, 'r');
    const { size } = fstatSync(fd);
    const length = Math.min(size, bytes);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** The calling subagent's context size from its transcript; null for the main session or an unreadable transcript. */
export function subagentContextOf(payload) {
  if (!payload.agent_id) return null;
  const file = subagentTranscriptPath(payload);
  const text = file && readTail(file);
  return text ? contextSizeOf(text) : null;
}

/** Whether the calling subagent's context has reached the host's budget: what the stop gate asks too. */
export const overBudget = (payload, config) => {
  const size = subagentContextOf(payload);
  return size !== null && size >= budgetOf(config);
};

export function contextBudgetCheck(payload, { config }) {
  if (!payload.agent_id || HANDBACK_TOOLS.has(payload.tool_name)) return allow();
  return decide({ size: subagentContextOf(payload), budget: budgetOf(config) });
}

// Run only when spawned as the hook; the tests import the pieces above.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(contextBudgetCheck);
}
