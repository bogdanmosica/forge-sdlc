#!/usr/bin/env node
// Guardrail: one pushed branch per effort. PreToolUse on Bash `git push`: on a host with
// docs/agents/forge.md, deny a push whose ref on origin is anything but the effort glob
// (`feat/*`), including `--all` and `--mirror`; on a host without it, deny only a `slice/*`
// ref. A bare push, `HEAD` or `@` resolve to the checked-out branch of the checkout the push
// runs in (after a `cd` earlier in the command, or the push's own `-C`). Deletes pass: removing
// a ref from origin is cleanup. Tags pass (`refs/tags/...`, `--tags`, or a name that is a tag and
// not a branch in that checkout): the rule is about branches.

import path from 'node:path';

import { allow, branchRules, currentBranch, cwdOf, deny, git, localBranches, matchesGlob, nearestExisting, run } from './lib.mjs';

/** `git push` options whose value is the next word when not written `--opt=value`. */
const VALUED = new Set(['-o', '--push-option', '--receive-pack', '--exec', '--repo']);
/** Global git options whose value is the next word. */
const GLOBAL_VALUED = new Set(['-C', '-c']);

const unquote = (word) => word.replace(/^(["'])(.*)\1$/, '$2');

/** A `cd` target as the shell resolves it from `dir`; `cd`, `cd -` and `cd ~user` are not followed. */
function cdTarget(word, dir) {
  if (!word || word === '-' || /^~[^/]/.test(word)) return dir;
  const target = unquote(word);
  return target === '~' || target.startsWith('~/')
    ? path.join(process.env.HOME ?? '', target.slice(1))
    : path.resolve(dir, target);
}

/** `{ deletes, all, refspecs }` of the words after `push`. */
function pushArgs(args) {
  const positional = [];
  let deletes = false;
  let all = false;
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i];
    if (word === '--') {
      positional.push(...args.slice(i + 1).map(unquote));
      break;
    }
    if (!word.startsWith('-')) positional.push(unquote(word));
    else if (word === '-d' || word === '--delete') deletes = true;
    else if (word === '--all' || word === '--mirror' || word === '--branches') all = true;
    else if (VALUED.has(word)) i += 1;
  }
  return { deletes, all, refspecs: positional.slice(1) };
}

/** One `git [globals] push ...` segment as `{ dir, deletes, all, refspecs }`; null for another git command. */
function pushFrom(words, dir) {
  let i = 1;
  let at = dir;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C' && i + 1 < words.length) at = path.resolve(at, unquote(words[i + 1]));
    i += GLOBAL_VALUED.has(words[i]) ? 2 : 1;
  }
  return words[i] === 'push' ? { dir: at, ...pushArgs(words.slice(i + 1)) } : null;
}

/** Every `git push` in a Bash command, split at operators, each with the checkout it runs in. */
export function pushesOf(command, cwd) {
  const pushes = [];
  let dir = cwd;
  for (const segment of (command ?? '').split(/[;&|\n`()]+/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    if (words[0] === 'cd') dir = cdTarget(words[1], dir);
    if (words[0] !== 'git') continue;
    const push = pushFrom(words, dir);
    if (push) pushes.push(push);
  }
  return pushes;
}

const shortName = (ref) => ref.replace(/^refs\/heads\//, '');

/** Whether `ref` names a tag of the checkout in `dir` and not a branch (`git push origin v1.0.0`). */
function isTag(dir, ref) {
  if (ref.startsWith('refs/tags/')) return true;
  const at = nearestExisting(dir);
  const verify = (full) => git(['-C', at, 'show-ref', '--verify', '--quiet', full]).status === 0;
  return verify(`refs/tags/${ref}`) && !verify(`refs/heads/${ref}`);
}

/** The refs a push writes on origin: a refspec's destination, else its source; HEAD and @ are the checked-out branch. */
function publishedRefs(push) {
  if (push.refspecs.length === 0) return [currentBranch(push.dir)];
  const refs = [];
  for (const refspec of push.refspecs) {
    const [source, target] = refspec.replace(/^\+/, '').split(':');
    if (source === '' && target !== undefined) continue; // `:ref` deletes
    const destination = target || source;
    refs.push(['HEAD', '@'].includes(destination) ? currentBranch(push.dir) : destination);
  }
  return refs;
}

/** The ref the push would publish against the rules, or undefined when it publishes none. */
export function offendingRef(push, rules) {
  if (push.deletes) return undefined;
  const offends = (ref) => (rules.configured ? !matchesGlob(ref, rules.effort) : matchesGlob(ref, rules.slice));
  if (push.all) return rules.configured ? '--all' : localBranches(push.dir, rules.slice)[0];
  return publishedRefs(push)
    .filter((ref) => ref && !isTag(push.dir, ref)) // a detached HEAD or a non-repo publishes nothing git would accept
    .map(shortName)
    .find(offends);
}

export function slicePushCheck(payload, { config }) {
  if (payload.tool_name !== 'Bash') return allow();
  for (const push of pushesOf(payload.tool_input?.command, cwdOf(payload))) {
    const rules = branchRules(config, push.dir);
    const hit = offendingRef(push, rules);
    if (!hit) continue;
    const effort = rules.effort.replace('*', '<slug>');
    if (hit === '--all') {
      return deny(
        `A push of every branch is refused: only the effort branch ${effort} is pushed (docs/agents/forge.md, Branches). ` +
          'Slice branches stay local; the merger merges them into the effort branch. Push the effort branch by name.',
      );
    }
    return deny(
      rules.configured
        ? `Ref ${hit} is not the effort branch, and only ${effort} is pushed (docs/agents/forge.md, Branches). ` +
            'Slice branches stay local; the merger merges them into the effort branch. Push the effort branch instead.'
        : `Branch ${hit} is a slice branch, and slice branches are never pushed: a slice is a local worktree the ` +
            `merger merges into the effort branch ${effort}. Push the effort branch instead.`,
    );
  }
  return allow();
}

process.exitCode = await run(slicePushCheck);
