#!/usr/bin/env node
// Formatter: PostToolUse on Edit and Write. When docs/agents/forge.md names a Formatter command
// (not `none`), run it on the edited file in that file's checkout: `<file>` is replaced by the
// quoted path, else the path is appended. 10 s at most. The answer is always {}; a failed
// formatter is one line on stderr, its own output is kept off stdout.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { allow, checkoutRootOf, run } from './lib.mjs';

const TIMEOUT_MS = 10_000;
const shellQuote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

export function formatAfterEdit(payload, { config }) {
  if (payload.tool_name !== 'Edit' && payload.tool_name !== 'Write') return allow();
  const command = config?.formatter?.command;
  const filePath = payload.tool_input?.file_path;
  if (!command || command === 'none' || !filePath || !existsSync(filePath)) return allow();
  const quoted = shellQuote(path.resolve(filePath));
  const line = command.includes('<file>') ? command.replaceAll('<file>', quoted) : `${command} ${quoted}`;
  const r = spawnSync(line, {
    shell: true,
    cwd: checkoutRootOf(path.dirname(filePath)) ?? path.dirname(filePath),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: TIMEOUT_MS,
  });
  if (r.error || r.status !== 0) {
    const why = r.error ? r.error.code ?? r.error.message : `exit ${r.status ?? r.signal}`;
    process.stderr.write(`forge-sdlc format-after-edit: formatter failed on ${path.basename(filePath)} (${why}); fix the formatter command in docs/agents/forge.md, Formatter.\n`);
  }
  return allow();
}

process.exitCode = await run(formatAfterEdit);
