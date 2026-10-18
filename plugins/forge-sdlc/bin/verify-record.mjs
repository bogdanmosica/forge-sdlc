#!/usr/bin/env node
// The verifier's deterministic part: run a slice's proof, then the host's proof commands from
// docs/agents/forge.md, in the slice worktree; write .forge/verify/<slice>.json under the project
// dir (docs/contracts.md, "verify record"); print it; exit 0 when green, 1 when red, 2 on bad usage.
//
//   node verify-record.mjs --slice <slug-nn> --worktree <dir> --project <hostDir> [--proof "<command>"]
//
// Every command runs, a failure does not stop the next one. Output tails are masked for secret
// shapes before they reach the record or stdout.

import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { git, readHostConfig } from '../hooks/scripts/lib.mjs';

/** The host's proof commands, in the order they run. */
const PROOF_KEYS = ['test', 'typecheck', 'lint', 'build'];
const TAIL_LINES = 20;

/** Credential shapes masked in a tail; the whole match becomes [REDACTED]. */
const SECRETS = [
  /\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bya29\.[A-Za-z0-9._-]+/g,
  /\bAIza[A-Za-z0-9_-]{35}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /\b((?:AccountKey|password|passwd|pwd|secret|token|api[_-]?key|private_key)\s*[=:]\s*)["']?[^\s"';,]+/gi,
  /(\/\/[^\s:/@]+:)[^\s@/]+(?=@)/g,
];

/** `text` with every secret shape replaced by [REDACTED]; a captured prefix (`Bearer `, `password=`) is kept. */
const mask = (text) => SECRETS.reduce((t, re) => t.replace(re, (m, prefix) => (typeof prefix === 'string' ? `${prefix}[REDACTED]` : '[REDACTED]')), text);

const tailOf = (output) => mask(output.trimEnd().split('\n').slice(-TAIL_LINES).join('\n'));

/** Run one command in `cwd` through the shell, stderr merged into stdout. */
function runOne(name, command, cwd) {
  const started = Date.now();
  const r = spawnSync('/bin/sh', ['-c', `{ ${command}\n} 2>&1`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  return { name, command, exitCode: r.status ?? 1, ms: Date.now() - started, tail: tailOf(`${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? r.error.message : ''}`) };
}

/** The runs to make: the proof when given, then each host proof command not set to none. */
function commandsOf(config, proof) {
  const host = config?.['proof-commands'] ?? {};
  const set = (value) => value && value.toLowerCase() !== 'none';
  return [...(proof ? [['proof', proof]] : []), ...PROOF_KEYS.filter((k) => set(host[k])).map((k) => [k, host[k]])];
}

function main(argv) {
  const usage = 'usage: verify-record.mjs --slice <slug-nn> --worktree <dir> --project <hostDir> [--proof "<command>"]';
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: { slice: { type: 'string' }, worktree: { type: 'string' }, project: { type: 'string' }, proof: { type: 'string' } } }));
  } catch (e) {
    process.stderr.write(`${e.message}\n${usage}\n`);
    return 2;
  }
  const missing = ['slice', 'worktree', 'project'].filter((k) => !values[k]);
  if (missing.length) {
    process.stderr.write(`missing ${missing.map((k) => `--${k}`).join(', ')}\n${usage}\n`);
    return 2;
  }
  const worktree = path.resolve(values.worktree);
  const project = path.resolve(values.project);
  const head = git(['-C', worktree, 'rev-parse', 'HEAD']);
  if (head.status !== 0) {
    process.stderr.write(`${worktree} is not a git worktree with a commit\n`);
    return 2;
  }
  const record = { slice: values.slice, head: head.stdout.trim(), at: new Date().toISOString(), green: false, runs: [] };
  record.runs = commandsOf(readHostConfig(project), values.proof).map(([name, command]) => runOne(name, command, worktree));
  record.green = record.runs.length > 0 && record.runs.every((r) => r.exitCode === 0); // nothing run proves nothing

  const file = path.join(project, '.forge', 'verify', `${values.slice}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  const text = `${JSON.stringify(record, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
  process.stdout.write(text);
  return record.green ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
