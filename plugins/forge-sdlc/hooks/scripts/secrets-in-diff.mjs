#!/usr/bin/env node
// Guardrail: secrets in the diff. PreToolUse on Bash `git commit`: scan the lines the commit
// would add, in the checkout it runs in, for credential shapes, and deny on any hit. "Would add"
// is what is staged plus what the same command stages first: `git add …` segments before the
// commit, `git commit -a` (every tracked change) and `git commit <pathspec>`. The staging is
// simulated in a throwaway copy of the index, so the real index is never touched. The reason
// names the path and the pattern only: a matched value is never quoted, logged or kept.
// Quiet when the commit would add nothing or runs outside a repository.

import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { allow, cwdOf, deny, git, gitSegmentsOf, isGitCommit, run } from './lib.mjs';

/** Credential shapes, first match per line wins, so the more specific `sk-` forms come first. */
const PATTERNS = [
  ['AWS access key id', /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/],
  ['AWS secret access key', /secret_?access_?key["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/i],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI project key', /\bsk-proj-[A-Za-z0-9_-]{20,}/],
  ['OpenAI key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['Google OAuth token', /\bya29\.[0-9A-Za-z_-]{20,}/],
  ['Bearer token', /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/],
  ['private_key', /["']?private_key["']?\s*[:=]|-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Azure AccountKey', /AccountKey=[A-Za-z0-9+/=]{20,}/],
  ['credentials in a URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"]+:[^\s@/'"]+@/i],
];

/** A dotenv file: `.env` or `.env.<anything>`, in any folder. */
const ENV_FILE = /(^|\/)\.env(\.[^/]+)?$/;

/** `git commit` options whose value is the next word, so the value is not read as a pathspec. */
const COMMIT_VALUED = new Set([
  '-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message', '--author', '--date',
  '-t', '--template', '--fixup', '--squash', '--cleanup', '--trailer', '--pathspec-from-file',
]);

/** `git add` forms that cannot be simulated or stage nothing: interactive, patch, edit, dry run. */
const ADD_SKIPPED = /^(-[a-zA-Z]*[ipen][a-zA-Z]*|--interactive|--patch|--edit|--dry-run)$/;

/** `{ all, paths }` of a commit's args: `-a`/`--all` (also inside `-am`), and explicit pathspecs. */
export function commitArgs(args) {
  let all = false;
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i];
    if (word === '--') {
      paths.push(...args.slice(i + 1));
      break;
    }
    if (word === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(word)) all = true;
    if (COMMIT_VALUED.has(word)) i += 1;
    else if (/^-[a-zA-Z]*m$/.test(word)) i += 1; // `-am wip`, `-qm wip`: the message follows
    else if (!word.startsWith('-')) paths.push(word);
  }
  return { all, paths };
}

const toplevelOf = (dir) => {
  const r = git(['-C', dir, 'rev-parse', '--show-toplevel']);
  return r.status === 0 ? r.stdout.trim() : null;
};

/**
 * Stage, in a throwaway copy of the checkout's index, what the command would stage before
 * `commit`: the `git add` segments before it in the same repository, `-a`, and pathspecs.
 * Returns the env that points git at that copy, and the folder to remove afterwards.
 */
function simulatedIndex(commit, segments, commitIndex) {
  const top = toplevelOf(commit.dir);
  const folder = mkdtempSync(path.join(tmpdir(), 'forge-secrets-'));
  const tmp = path.join(folder, 'index');
  const real = git(['-C', commit.dir, 'rev-parse', '--git-path', 'index']);
  const realPath = path.resolve(commit.dir, real.stdout.trim());
  if (real.status === 0 && existsSync(realPath)) copyFileSync(realPath, tmp);
  const env = { ...process.env, GIT_INDEX_FILE: tmp };
  for (const seg of segments.slice(0, commitIndex)) {
    if (seg.sub !== 'add' || toplevelOf(seg.dir) !== top || seg.args.some((a) => ADD_SKIPPED.test(a))) continue;
    git(['-C', seg.dir, 'add', ...seg.args], env);
  }
  const { all, paths } = commitArgs(commit.args);
  if (all) git(['-C', commit.dir, 'add', '-u'], env);
  if (paths.length) git(['-C', commit.dir, 'add', '--ignore-errors', '--', ...paths], env);
  return { env, folder };
}

/** `path: pattern` lines for the diff the index in `env` would commit from `dir`; null outside a repository. */
function hitsOf(dir, env) {
  const diff = git(['-C', dir, 'diff', '--cached', '--no-color', '--no-ext-diff', '-U0'], env);
  if (diff.status !== 0) return null;
  const hits = new Set();
  let file = null;
  let inHeader = false;
  for (const line of diff.stdout.split('\n')) {
    if (line.startsWith('diff --git ')) inHeader = true;
    else if (line.startsWith('@@')) inHeader = false;
    if (inHeader && line.startsWith('+++ ')) {
      file = line === '+++ /dev/null' ? null : line.slice(4).replace(/^b\//, '');
      continue;
    }
    if (!file || !line.startsWith('+')) continue;
    const hit = PATTERNS.find(([, re]) => re.test(line));
    if (hit) hits.add(`${file}: ${hit[0]}`);
  }
  const added = git(['-C', dir, 'diff', '--cached', '--name-only', '--diff-filter=A'], env);
  for (const name of added.stdout.split('\n')) if (ENV_FILE.test(name)) hits.add(`${name}: .env file`);
  return [...hits];
}

export function secretsInDiffCheck(payload) {
  if (payload.tool_name !== 'Bash' || !isGitCommit(payload.tool_input?.command)) return allow();
  const segments = gitSegmentsOf(payload.tool_input.command, cwdOf(payload));
  for (const [i, seg] of segments.entries()) {
    if (seg.sub !== 'commit' || !toplevelOf(seg.dir)) continue;
    const { env, folder } = simulatedIndex(seg, segments, i);
    let hits;
    try {
      hits = hitsOf(seg.dir, env);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
    if (!hits?.length) continue;
    return deny(
      `This commit would add credential shapes (${hits.join('; ')}). The commit is refused. ` +
        'Leave those lines out of the commit, read the value from an environment variable or a secrets manager, ' +
        'and use a placeholder such as <YOUR_API_KEY> in examples. If the value was real and ever left this machine, rotate it.',
    );
  }
  return allow();
}

process.exitCode = await run(secretsInDiffCheck);
