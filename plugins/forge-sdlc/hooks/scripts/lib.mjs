// Shared seam of the guardrail hooks. Each guardrail is one script: read the hook payload
// from stdin, read the host config, decide, write one JSON decision to stdout, exit 0.
// Reasons name branches, paths and pattern names; never a matched value.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The host config `/forge-sdlc:init` writes, relative to the project dir. */
export const HOST_CONFIG = path.join('docs', 'agents', 'forge.md');

/** The run state of the loop, relative to the project dir (docs/contracts.md). */
export const STATE_FILE = path.join('.forge', 'state.json');

/** Branch shapes used when the host config names none. */
export const DEFAULT_BRANCHES = { effort: 'feat/<slug>', slice: 'slice/<slug>-<nn>' };

/* Payload */

export const cwdOf = (payload) => payload.cwd || process.cwd();

/** The hook payload: one JSON object on stdin. Empty or unparsable input is `{}`. */
export async function readPayload(stream = process.stdin) {
  let text = '';
  for await (const chunk of stream) text += chunk;
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** The project dir, where the host config lives: the engine's CLAUDE_PROJECT_DIR, else the payload's cwd. */
export function projectDirOf(payload, env = process.env) {
  return env.CLAUDE_PROJECT_DIR || cwdOf(payload);
}

/* Host config: docs/agents/forge.md, a markdown file of `## Section` headings and `- key: value` bullets. */

const sectionKey = (heading) => heading.trim().toLowerCase().replace(/\s+/g, '-');
const unquote = (word) => word.replace(/^(["'`])(.*)\1$/, '$2');

/** `{ [section]: { [key]: value } }` of a forge.md text; a trailing `# comment` is dropped, backticks stripped. */
export function parseForgeConfig(text) {
  const config = {};
  let section = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd();
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      section = sectionKey(heading[1]);
      config[section] ??= {};
      continue;
    }
    const bullet = /^-\s+([^:]+):\s*(.*)$/.exec(line);
    if (bullet && section) config[section][bullet[1].trim()] = unquote(bullet[2].trim());
  }
  return config;
}

/** The parsed host config, or null when the host has none (init not run). */
export function readHostConfig(projectDir) {
  const file = path.join(projectDir, HOST_CONFIG);
  if (!existsSync(file)) return null;
  return parseForgeConfig(readFileSync(file, 'utf8'));
}

/** A comma-separated config value as a list. */
export const listOf = (value) => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** A branch shape as a glob: `feat/<slug>` is `feat/*`. */
export const globOfShape = (shape) => shape.replace(/<[^>]+>/g, '*');

/**
 * The branch rules in force for the checkout in `dir`: the default branch (config, else
 * detected from origin/HEAD, else `main` or `master` when one exists), the protected globs
 * (the default branch plus the config's list), the effort and slice globs, and whether a
 * config exists at all.
 */
export function branchRules(config, dir) {
  const branches = config?.branches ?? {};
  const defaultBranch = branches.default || detectDefaultBranch(dir);
  return {
    configured: config !== null && config !== undefined,
    defaultBranch,
    protected: [...new Set([defaultBranch, ...listOf(branches.protected)].filter(Boolean))],
    effort: globOfShape(branches.effort || DEFAULT_BRANCHES.effort),
    slice: globOfShape(branches.slice || DEFAULT_BRANCHES.slice),
  };
}

/* Run state: .forge/state.json (docs/contracts.md). */

/** The state, or null when no effort has started on this host. A malformed file throws: it is never silently reset. */
export function readState(projectDir) {
  const file = path.join(projectDir, STATE_FILE);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: ${e.message}`, { cause: e });
  }
}

/** Write the state atomically (temp file, then rename), creating .forge/ when needed. */
export function writeState(projectDir, state) {
  const file = path.join(projectDir, STATE_FILE);
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ version: 1, ...state }, null, 2)}\n`);
  renameSync(tmp, file);
}

/** The effort record for `slug`, or null. */
export const effortOf = (state, slug) => state?.efforts?.[slug] ?? null;

/* Git */

export function git(args, env = process.env) {
  return spawnSync('git', args, { encoding: 'utf8', env });
}

/** `p` itself when it exists, else its nearest existing ancestor: a Write to a new folder still resolves. */
export function nearestExisting(p) {
  let probe = path.resolve(p);
  while (!existsSync(probe) && path.dirname(probe) !== probe) probe = path.dirname(probe);
  return probe;
}

/** The checked-out branch of the repository holding `dir`: '' on a detached HEAD, null outside a work tree. */
export function currentBranch(dir) {
  const r = git(['-C', nearestExisting(dir), 'branch', '--show-current']);
  return r.status === 0 ? r.stdout.trim() : null;
}

/**
 * The host dir whose `.forge/` holds the run state for a path: the main checkout of the repository
 * holding `dir` (the parent of its git common dir), so a slice worktree resolves to its host even
 * for a session whose project dir is a slice worktree. `fallback` outside a repo.
 */
export function hostDirOf(dir, fallback) {
  const r = git(['-C', nearestExisting(dir), 'rev-parse', '--path-format=absolute', '--git-common-dir']);
  return r.status === 0 ? path.dirname(r.stdout.trim()) : fallback;
}

/** The default branch of the repository holding `dir`, or null when it cannot be told. */
export function detectDefaultBranch(dir) {
  const at = nearestExisting(dir);
  const head = git(['-C', at, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (head.status === 0) return head.stdout.trim().replace(/^origin\//, '');
  for (const name of ['main', 'master']) {
    if (git(['-C', at, 'show-ref', '--verify', '--quiet', `refs/heads/${name}`]).status === 0) return name;
  }
  return null;
}

/** Local branches of the checkout in `dir` matching `glob`. */
export function localBranches(dir, glob) {
  const r = git(['-C', nearestExisting(dir), 'branch', '--list', glob, '--format=%(refname:short)']);
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : [];
}

/** The words of one shell segment, honouring single and double quotes; quotes are stripped. */
export function shellWords(segment) {
  const words = [];
  let word = '';
  let quote = null;
  let open = false;
  for (const ch of segment) {
    if (quote) {
      if (ch === quote) quote = null;
      else word += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      open = true;
    } else if (/\s/.test(ch)) {
      if (word || open) words.push(word);
      word = '';
      open = false;
    } else word += ch;
  }
  if (word || open) words.push(word);
  return words;
}

/** A `cd` target as the shell resolves it from `dir`; `cd`, `cd -` and `cd ~user` are not followed. */
export function cdTarget(word, dir) {
  if (!word || word === '-' || /^~[^/]/.test(word)) return dir;
  return word === '~' || word.startsWith('~/') ? path.join(process.env.HOME ?? '', word.slice(1)) : path.resolve(dir, word);
}

/**
 * Every `git [globals] <sub> args…` in a Bash command, split at shell operators, as
 * `{ dir, sub, args }` with the checkout it runs in: a `cd` earlier in the command moves it,
 * as does the segment's own `-C`. Global options with a value (`-C`, `-c`) are consumed.
 */
export function gitSegmentsOf(command, cwd) {
  const out = [];
  let dir = cwd;
  for (const segment of (command ?? '').split(/[;&|\n`()]+/)) {
    const words = shellWords(segment.trim());
    if (words[0] === 'cd') {
      dir = cdTarget(words[1], dir);
      continue;
    }
    if (words[0] !== 'git') continue;
    let i = 1;
    let at = dir;
    while (i < words.length && words[i].startsWith('-')) {
      if (words[i] === '-C' && i + 1 < words.length) at = path.resolve(at, words[i + 1]);
      i += ['-C', '-c'].includes(words[i]) ? 2 : 1;
    }
    if (i < words.length) out.push({ dir: at, sub: words[i], args: words.slice(i + 1) });
  }
  return out;
}

/** Whether a Bash command text contains a `git commit` (`git -c k=v commit`, `git -C dir commit`, chained forms). */
const GIT_COMMIT = /(^|[\s;&|(`])git(\s+-[^\s]+(\s+[^\s-][^\s]*)?)*\s+commit\b/;
export const isGitCommit = (command) => GIT_COMMIT.test(command ?? '');

/**
 * The directory a `git [-C <dir>]... commit` in a Bash command runs in: each `-C` resolved
 * against the previous one, the first against `cwd`, as git does. Null without a commit or a `-C`.
 */
export function commitDirOf(command, cwd) {
  const m = GIT_COMMIT.exec(command ?? '');
  if (!m) return null;
  const tokens = m[0].trim().split(/\s+/);
  let dir = null;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (tokens[i] !== '-C') continue;
    dir = path.resolve(dir ?? cwd, unquote(tokens[i + 1]));
    i += 1;
  }
  return dir;
}

/**
 * The directory the tool call acts on: the file's folder for Edit, Write and NotebookEdit
 * (`file_path` is absolute and may sit in another worktree than cwd); for a Bash
 * `git -C <dir> commit`, the checkout in `<dir>`; else the payload's cwd.
 */
export function targetDirOf(payload) {
  const filePath = payload.tool_input?.file_path || payload.tool_input?.notebook_path;
  if (filePath) return path.dirname(filePath);
  return commitDirOf(payload.tool_input?.command, cwdOf(payload)) ?? cwdOf(payload);
}

/** Branch globs: `*` spans any text, including `/`, so `release/*` covers `release/2026/10`. */
export function matchesGlob(name, pattern) {
  const escaped = pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${escaped.join('.*')}$`).test(name);
}

/** The root of the checkout holding `p`: the nearest folder with a `.git` (a folder, or a worktree's file), or null. */
export function checkoutRootOf(p) {
  let dir = nearestExisting(p);
  for (;;) {
    if (existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return null;
    dir = path.dirname(dir);
  }
}

/**
 * Path globs over a `/`-separated relative path: `**` spans folders (`**` then `/` also matches
 * no folder), `*` stays inside one segment. `**\/*.test.*` covers `a.test.ts` and `src/x/a.test.ts`.
 */
export function matchesPath(rel, glob) {
  const source = glob
    .split(/(\*\*\/|\*\*|\*)/)
    .map((part) => {
      if (part === '**/') return '(?:.*/)?';
      if (part === '**') return '.*';
      if (part === '*') return '[^/]*';
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${source}$`).test(rel);
}

/* Decisions */

/** PreToolUse: refuse the call. Holds in every permission mode. */
export const deny = (reason) => ({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
});

/** No decision: the call proceeds through the normal permission flow. */
export const allow = () => ({});

/** Stop and SubagentStop: keep Claude working; `reason` is what it reads next. */
export const block = (reason) => ({ decision: 'block', reason });

/**
 * Run a guardrail: `check(payload, { projectDir, config })` returns a decision, written as the
 * only thing on stdout. An error is reported on stderr with exit 1 and no decision: a hook is a
 * reminder for the agent, not a sandbox; the git host stays the enforcement of record.
 */
export async function run(check, { stdin = process.stdin, stdout = process.stdout, env = process.env } = {}) {
  try {
    const payload = await readPayload(stdin);
    const projectDir = projectDirOf(payload, env);
    const config = readHostConfig(projectDir);
    const decision = await check(payload, { projectDir, config, env });
    stdout.write(JSON.stringify(decision ?? {}));
    return 0;
  } catch (e) {
    process.stderr.write(`forge-sdlc hook: ${e.message}\n`);
    return 1;
  }
}
