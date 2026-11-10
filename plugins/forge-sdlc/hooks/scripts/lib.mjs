// Shared seam of the guardrail hooks. Each guardrail is one script: read the hook payload
// from stdin, read the host config, decide, write one JSON decision to stdout, exit 0.
// Reasons name branches, paths and pattern names; never a matched value.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
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

/** The problem a `dependency_dir` other than none is since 0.7.0 (ADR 0022); the run pane's worktrees.ts says the same. */
export const DEPENDENCY_DIR_PROBLEM =
  'worktrees: dependency_dir is no longer read (0.7.0): slice worktrees get a real install, never a symlink. ' +
  'Set `- install: <command>` under ## Worktrees (or `- install: none`) and set dependency_dir to none or drop it';

/**
 * The host's `## Worktrees` install: `{ command, problems }`. `command` is run at the root of each
 * new slice worktree, null for `none` or no key. A `dependency_dir` other than none is a problem:
 * no symlink is made any more, whatever it names.
 */
export function worktreeInstall(config) {
  const section = config?.worktrees ?? {};
  const install = section.install?.trim() ?? '';
  const dependencyDir = section.dependency_dir?.trim() ?? '';
  return {
    command: install && install.toLowerCase() !== 'none' ? install : null,
    problems: dependencyDir && dependencyDir.toLowerCase() !== 'none' ? [DEPENDENCY_DIR_PROBLEM] : [],
  };
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

/** `{ at, checkout, main }` for `dir`: its real path, the root of the checkout holding it, and the main checkout (the parent of the git common dir); null outside a repo. */
function checkoutsOf(dir) {
  const at = realpathSync(nearestExisting(dir));
  const common = git(['-C', at, 'rev-parse', '--path-format=absolute', '--git-common-dir']);
  const top = git(['-C', at, 'rev-parse', '--show-toplevel']);
  if (common.status !== 0 || top.status !== 0) return null;
  return { at, checkout: realpathSync(top.stdout.trim()), main: realpathSync(path.dirname(common.stdout.trim())) };
}

/**
 * Where slice `<slug>-<nn>`'s worktree lives: outside the repository, beside its main checkout,
 * `<parent of main checkout>/<main checkout's folder name>-worktrees/<slug>-<nn>` (ADR 0022), for
 * any `dir` in the repository or in one of its worktrees. Null outside a repo.
 */
export function sliceWorktreeDir(dir, slice) {
  const found = checkoutsOf(dir);
  if (!found) return null;
  return path.join(path.dirname(found.main), `${path.basename(found.main)}-worktrees`, slice);
}

/** The pre-0.7.0 slice worktree of `host`, `<host>/.forge/worktrees/<slice>`: read as a fallback only. */
export const legacySliceWorktreeDir = (host, slice) => path.join(host, '.forge', 'worktrees', slice);

/** The host dirs of the main checkout `main`: every folder holding docs/agents/forge.md, tracked or not (ignored files skipped). */
function hostsUnder(main) {
  const r = git(['-C', main, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', `:(glob)**/${HOST_CONFIG.split(path.sep).join('/')}`]);
  if (r.status !== 0) return [];
  const dirs = r.stdout.split('\0').filter(Boolean).map((f) => path.join(main, path.dirname(path.dirname(path.dirname(f)))));
  return [...new Set(dirs)];
}

/** The host under `main` whose state holds the slice `branch` names (under that host's slice shape), or null. */
function hostOfSliceBranch(branch, main) {
  for (const host of hostsUnder(main)) {
    const config = readHostConfig(host);
    const shape = config?.branches?.slice || DEFAULT_BRANCHES.slice;
    if (!matchesGlob(branch, globOfShape(shape))) continue;
    const slice = branch.slice(shape.indexOf('<'));
    let state;
    try {
      state = readState(host);
    } catch {
      continue;
    }
    if (effortOf(state, slice.replace(/-\d+$/, ''))?.slices?.[slice]) return host;
  }
  return null;
}

/**
 * The host dir whose `.forge/` holds the run state for a path, so a slice worktree resolves to its
 * host even for a session whose project dir is a slice worktree. `fallback` outside a repo.
 * - The folder of the main checkout (the parent of the git common dir) at the same place as
 *   `dir`, then up to the nearest one holding docs/agents/forge.md. So a host that is a subfolder
 *   of its repository (a monorepo's `projects/<x>`) resolves to itself, from the main checkout and
 *   from deep inside any worktree, and a single-repo host to its root.
 * - Else, in a linked worktree (a slice worktree, outside the repository since 0.7.0, ADR 0022):
 *   the host whose `.forge/state.json` holds the slice its branch names, so a cwd at the worktree
 *   root or in another project folder still finds a subfolder host.
 * - Else, in a pre-0.7.0 checkout at `<host>/.forge/worktrees/<slice>`: that `<host>`.
 * - Else the main checkout.
 */
export function hostDirOf(dir, fallback) {
  const found = checkoutsOf(dir);
  if (!found) return fallback;
  const { at, checkout, main } = found;
  for (let probe = path.join(main, path.relative(checkout, at)); ; probe = path.dirname(probe)) {
    if (existsSync(path.join(probe, HOST_CONFIG))) return probe;
    if (probe === main || path.dirname(probe) === probe) break;
  }
  if (checkout === main) return main;
  const branch = currentBranch(checkout);
  const host = branch ? hostOfSliceBranch(branch, main) : null;
  if (host) return host;
  const legacy = path.dirname(path.dirname(checkout));
  if (path.basename(path.dirname(checkout)) === 'worktrees' && path.basename(legacy) === '.forge') return path.dirname(legacy);
  return main;
}

/** Where `host` sits inside the checkout holding `dir`: `host` mapped from the main checkout onto that checkout (a slice worktree checks out the whole repository). */
export function hostInCheckout(host, dir) {
  const found = checkoutsOf(dir);
  if (!found) return host;
  const rel = path.relative(found.main, realpathSync(nearestExisting(host)));
  if (rel.startsWith('..') || path.isAbsolute(rel)) return host;
  return path.join(found.checkout, rel);
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

/** Characters that end a shell segment when they stand outside quotes. */
const SEGMENT_END = new Set([';', '&', '|', '\n', '`', '(', ')']);

/** A heredoc operator and its delimiter word: `<<EOF`, `<<-EOF`, `<< 'EOF'`, `<<"EOF"`, `<<\EOF`. */
const HEREDOC = /^<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([A-Za-z_][\w.-]*))/;

/** The heredoc opening at `text[i]` as `{ delimiter, dash, length }`, or null (a here-string `<<<` is none). */
function heredocAt(text, i) {
  if (!text.startsWith('<<', i) || text.startsWith('<<<', i)) return null;
  const m = HEREDOC.exec(text.slice(i));
  return m ? { delimiter: m[2] ?? m[3] ?? m[4], dash: m[1] === '-', length: m[0].length } : null;
}

/** The index after the bodies of `docs`, read line by line from `i` up to each one's delimiter line. */
function afterHeredocBodies(text, i, docs) {
  let at = i;
  for (const doc of docs) {
    while (at < text.length) {
      const nl = text.indexOf('\n', at);
      const line = text.slice(at, nl === -1 ? text.length : nl);
      at = nl === -1 ? text.length : nl + 1;
      if ((doc.dash ? line.replace(/^\t+/, '') : line) === doc.delimiter) break;
    }
  }
  return at;
}

/**
 * The segments of a Bash command, split at shell operators that stand outside quotes, so a
 * `;` or `&&` inside a quoted argument stays in its segment. Heredoc bodies are data and are
 * left out, as is the `<<word` that opens them. Quotes are kept for shellWords; a backslash
 * outside single quotes escapes the next character. `<<<` here-strings pass through as text.
 */
export function shellSegments(command) {
  const text = command ?? '';
  const state = { segments: [], docs: [], current: '', quote: null };
  let i = 0;
  while (i < text.length) i = shellStep(text, i, state);
  state.segments.push(state.current);
  return state.segments.map((s) => s.trim()).filter(Boolean);
}

/** Append `n` characters from `text[i]` to the current segment; the next index. */
function appendTo(state, text, i, n) {
  state.current += text.slice(i, i + n);
  return i + n;
}

/** One step of shellSegments from `text[i]`: updates `state`, returns the next index. */
function shellStep(text, i, state) {
  const ch = text[i];
  const escape = ch === '\\' && state.quote !== "'";
  if (state.quote || escape) {
    if (ch === state.quote) state.quote = null;
    return appendTo(state, text, i, escape ? 2 : 1);
  }
  if (ch === '"' || ch === "'") {
    state.quote = ch;
    return appendTo(state, text, i, 1);
  }
  if (text.startsWith('<<<', i)) return appendTo(state, text, i, 3);
  const doc = heredocAt(text, i);
  if (doc) {
    state.docs.push(doc);
    return i + doc.length;
  }
  if (!SEGMENT_END.has(ch)) return appendTo(state, text, i, 1);
  state.segments.push(state.current);
  state.current = '';
  if (ch !== '\n' || state.docs.length === 0) return i + 1;
  const next = afterHeredocBodies(text, i + 1, state.docs);
  state.docs = [];
  return next;
}

/**
 * Every `git [globals] <sub> args…` in a Bash command, split at shell operators, as
 * `{ dir, sub, args }` with the checkout it runs in: a `cd` earlier in the command moves it,
 * as does the segment's own `-C`. Global options with a value (`-C`, `-c`) are consumed.
 */
export function gitSegmentsOf(command, cwd) {
  const out = [];
  let dir = cwd;
  for (const segment of shellSegments(command)) {
    const words = shellWords(segment.trim());
    if (words[0] === 'cd') dir = cdTarget(words[1], dir);
    else if (words[0] === 'git') {
      const parsed = gitSegment(words, dir);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

/** `{ dir, sub, args }` of one `git [globals] <sub> args…` segment's words run from `dir`; null without a subcommand. */
function gitSegment(words, dir) {
  let i = 1;
  let at = dir;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C' && i + 1 < words.length) at = path.resolve(at, words[i + 1]);
    i += ['-C', '-c'].includes(words[i]) ? 2 : 1;
  }
  return i < words.length ? { dir: at, sub: words[i], args: words.slice(i + 1) } : null;
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
    // A session launched in a slice worktree of a subfolder host has no forge.md at its project
    // dir: the config is its host's, found through git.
    const config = readHostConfig(projectDir) ?? readHostConfig(hostDirOf(projectDir, projectDir));
    const decision = await check(payload, { projectDir, config, env });
    stdout.write(JSON.stringify(decision ?? {}));
    return 0;
  } catch (e) {
    process.stderr.write(`forge-sdlc hook: ${e.message}\n`);
    return 1;
  }
}
