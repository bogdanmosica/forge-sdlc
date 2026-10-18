#!/usr/bin/env node
// Prints the host config as JSON: `node bin/forge-config.mjs [host-dir]`. The parsed sections
// of docs/agents/forge.md plus the branch rules the hooks derive from them. Exit 1 with the
// path when the host has no config, so a skill can check init ran before it reads values.

import path from 'node:path';

import { branchRules, HOST_CONFIG, readHostConfig } from '../hooks/scripts/lib.mjs';

const dir = path.resolve(process.argv[2] ?? process.cwd());
const config = readHostConfig(dir);
if (!config) {
  process.stderr.write(`no host config at ${path.join(dir, HOST_CONFIG)}: run /forge-sdlc:init first\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ ...config, rules: branchRules(config, dir) }, null, 2)}\n`);
