#!/usr/bin/env node
// Resolve an upstream skill file: `node bin/skill-path.mjs <skill>` prints the absolute path of
// its SKILL.md in the installed mattpocock-skills plugin. The Skill tool refuses user-invoked
// skills from inside a skill, so the loop's commands read the file this prints and follow it.
//   --root     print the installed plugin's root instead
//   --check    print the UPSTREAM.lock verdict as JSON; exit 1 unless `ok`
// Exit 1 when the plugin is not installed (stderr names the install line), 2 when the plugin
// has no such skill. MATTPOCOCK_SKILLS_ROOT points at a plugin root directly.

import { checkUpstream, INSTALL_LINE, installedUpstream, skillFile, UPSTREAM } from './upstream.mjs';

const [arg] = process.argv.slice(2);
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

if (!arg || arg === '--help') {
  process.stderr.write('usage: skill-path.mjs <skill> | --root | --check\n');
  process.exit(arg ? 0 : 1);
}

if (arg === '--check') {
  const verdict = checkUpstream({ projectDir });
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  process.exit(verdict.status === 'ok' ? 0 : 1);
}

const installed = installedUpstream({ projectDir });
if (!installed) {
  process.stderr.write(`${UPSTREAM} is not installed. Install it: ${INSTALL_LINE}\n`);
  process.exit(1);
}

if (arg === '--root') {
  process.stdout.write(`${installed.root}\n`);
  process.exit(0);
}

const file = skillFile(installed.root, arg);
if (!file) {
  process.stderr.write(`${UPSTREAM} ${installed.version ?? ''} has no skill "${arg}" under ${installed.root}/skills\n`);
  process.exit(2);
}
process.stdout.write(`${file}\n`);
