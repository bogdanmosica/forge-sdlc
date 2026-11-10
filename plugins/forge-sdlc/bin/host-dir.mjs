#!/usr/bin/env node
// The host of a path: `node bin/host-dir.mjs [<dir>]` prints the folder whose `.forge/` holds the
// run state for `<dir>` (the cwd when omitted), resolved through git as the hooks resolve it
// (`hostDirOf`, ADR 0021 and 0022). From a slice worktree beside the repository it prints the
// host in the main checkout, `projects/<x>` for a subfolder host, never the worktree itself.
// Exit 0; 2 on bad usage or outside a git repository.

import path from 'node:path';

import { hostDirOf } from '../hooks/scripts/lib.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || args[0]?.startsWith('-')) {
  process.stderr.write('usage: host-dir.mjs [<dir>]\n');
  process.exit(2);
}
const dir = path.resolve(args[0] ?? process.cwd());
const host = hostDirOf(dir, null);
if (!host) {
  process.stderr.write(`${dir} is not in a git repository\n`);
  process.exit(2);
}
process.stdout.write(`${host}\n`);
