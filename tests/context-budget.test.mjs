// The context budget (plugins/forge-sdlc/hooks/scripts/context-budget.mjs): PreToolUse on every tool, a subagent
// whose context has reached the host's budget is denied the call and told to write its report.
// The main session (no `agent_id`) is never blocked; a missing or unparsable transcript passes.
// Pure pieces imported, the script spawned as Claude Code spawns it.
//
//   node --test tests/context-budget.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { hook } from './support/host.mjs';
import {
  DEFAULT_AGENT_CONTEXT,
  TAIL_BYTES,
  budgetOf,
  contextSizeOf,
  decide,
  subagentTranscriptPath,
} from '../plugins/forge-sdlc/hooks/scripts/context-budget.mjs';

const SESSION = 'sess-1';
const AGENT = 'a1b2';

const usageLine = ({ input = 2, read = 0, creation = 0 } = {}) =>
  JSON.stringify({
    type: 'assistant',
    agentId: AGENT,
    message: {
      usage: { input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: creation },
    },
  });
const userLine = () => JSON.stringify({ type: 'user', message: { content: 'tool result' } });

/** A project dir (host config optional) and the subagent transcript at the verified path, holding `lines`. */
function session({ lines, budgets } = {}) {
  const projects = mkdtempSync(path.join(tmpdir(), 'forge-budget-'));
  const projectDir = path.join(projects, 'host');
  mkdirSync(path.join(projectDir, 'docs', 'agents'), { recursive: true });
  if (budgets)
    writeFileSync(path.join(projectDir, 'docs', 'agents', 'forge.md'), `# forge-sdlc host config\n\n## Budgets\n${budgets}\n`);
  const transcriptPath = path.join(projects, `${SESSION}.jsonl`);
  writeFileSync(transcriptPath, `${userLine()}\n`);
  if (lines) {
    const dir = path.join(projects, SESSION, 'subagents');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `agent-${AGENT}.jsonl`), `${lines.join('\n')}\n`);
  }
  return { projectDir, transcriptPath };
}

const payload = ({ transcriptPath, projectDir }, extra = { agent_id: AGENT, agent_type: 'implementer' }) => ({
  hook_event_name: 'PreToolUse',
  tool_name: 'Read',
  tool_input: { file_path: '/x' },
  session_id: SESSION,
  transcript_path: transcriptPath,
  cwd: projectDir,
  ...extra,
});

const allowed = (r) => {
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.decision, {});
  return r.decision;
};
const denied = (r) => {
  assert.equal(r.status, 0, r.stderr);
  const out = r.decision.hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'deny');
  return out.permissionDecisionReason;
};

test('context budget: the subagent transcript sits under <dir of main transcript>/<session>/subagents', () => {
  assert.equal(
    subagentTranscriptPath({ transcript_path: '/p/proj/s.jsonl', session_id: 's', agent_id: 'x' }),
    path.join('/p/proj', 's', 'subagents', 'agent-x.jsonl'),
  );
  assert.equal(subagentTranscriptPath({ transcript_path: '/p/proj/s.jsonl', session_id: 's' }), null);
});

test('context budget: context is input + cache read + cache creation of the last line carrying usage', () => {
  const text = [
    usageLine({ input: 1, read: 900_000 }),
    usageLine({ input: 2, read: 100, creation: 30 }),
    userLine(),
    '{"partial',
  ].join('\n');
  assert.equal(contextSizeOf(text), 132);
  assert.equal(contextSizeOf(`${userLine()}\nnot json\n`), null);
  assert.equal(contextSizeOf(''), null);
});

test('context budget: budget defaults to 150000 and the host can override it', () => {
  assert.equal(DEFAULT_AGENT_CONTEXT, 150_000);
  assert.equal(budgetOf(null), 150_000);
  assert.equal(budgetOf({ budgets: { agent_context: '80000' } }), 80_000);
  assert.equal(budgetOf({ budgets: { agent_context: 'lots' } }), 150_000);
  assert.equal(budgetOf({ budgets: { agent_context: '0' } }), 150_000);
});

test('context budget: decide allows under the budget and denies at it, naming the budget', () => {
  assert.deepEqual(decide({ size: 149_999, budget: 150_000 }), {});
  assert.deepEqual(decide({ size: null, budget: 150_000 }), {});
  const reason = decide({ size: 150_000, budget: 150_000 }).hookSpecificOutput.permissionDecisionReason;
  assert.match(reason, /^Context budget 150k reached: stop calling tools, write your report now/);
  assert.match(reason, /what is done, what is left, and where \(files, commits\)/);
});

test('context budget: the main session (no agent_id) is never blocked, whatever the transcript says', () => {
  const s = session({ lines: [usageLine({ read: 900_000 })] });
  assert.deepEqual(allowed(hook('context-budget.mjs', payload(s, {}))), {});
});

test('context budget: a subagent under its budget proceeds', () => {
  const s = session({ lines: [usageLine({ input: 10, read: 100_000, creation: 4_000 })] });
  assert.deepEqual(allowed(hook('context-budget.mjs', payload(s))), {});
});

test('context budget: a subagent at or over its budget is denied with a reason naming the budget', () => {
  const at = session({ lines: [usageLine({ input: 0, read: 146_000, creation: 4_000 })] });
  assert.match(denied(hook('context-budget.mjs', payload(at))), /Context budget 150k reached/);
  const over = session({ lines: [usageLine({ read: 257_617, creation: 4_006 })] });
  assert.match(denied(hook('context-budget.mjs', payload(over))), /150k/);
});

test("context budget: the host's ## Budgets agent_context overrides the default", () => {
  const s = session({ lines: [usageLine({ read: 90_000 })], budgets: '- agent_context: 80000' });
  assert.match(denied(hook('context-budget.mjs', payload(s))), /Context budget 80k reached/);
});

test('context budget: a missing or unparsable transcript fails open', () => {
  assert.deepEqual(allowed(hook('context-budget.mjs', payload(session()))), {});
  assert.deepEqual(
    allowed(hook('context-budget.mjs', payload(session({ lines: ['garbage', '{"also": "no usage"}'] })))),
    {},
  );
});

test('context budget: the last usage line wins over an earlier, bigger one', () => {
  const s = session({ lines: [usageLine({ read: 400_000 }), userLine(), usageLine({ read: 20_000 }), userLine()] });
  assert.deepEqual(allowed(hook('context-budget.mjs', payload(s))), {});
});

test('context budget: only the tail of a big transcript is read', () => {
  const filler = Array.from({ length: Math.ceil((TAIL_BYTES * 2) / 1000) }, () =>
    JSON.stringify({ type: 'user', message: { content: 'x'.repeat(1000) } }),
  );
  // the only usage line lies before the tail: unseen, so the call proceeds
  const head = session({ lines: [usageLine({ read: 900_000 }), ...filler] });
  assert.deepEqual(allowed(hook('context-budget.mjs', payload(head))), {});
  // the same file with a usage line inside the tail is measured
  const tail = session({ lines: [...filler, usageLine({ read: 900_000 })] });
  assert.match(denied(hook('context-budget.mjs', payload(tail))), /150k/);
});

test('context budget: an over-budget subagent may still hand its report back', () => {
  const over = session({ lines: [usageLine({ read: 257_617, creation: 4_006 })] });
  for (const tool_name of ['SubagentHandback', 'SendMessage'])
    assert.deepEqual(allowed(hook('context-budget.mjs', { ...payload(over), tool_name })), {});
});
