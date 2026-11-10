// Worktrees: the host config's `## Worktrees` section, read for its problems so
// the band says when a host still names the pre-0.7.0 `dependency_dir`. Mirrors
// hooks/scripts/lib.mjs worktreeInstall, held to it by tests/slice-worktree.test.mjs.
// Pure: run-pane.tsx reads the file and calls `$`; this module only decides.
//
// Host config (`docs/agents/forge.md`), an optional section:
//   ## Worktrees
//   - install: <command>        run at the root of each new slice worktree; none for no install
//   - dependency_dir: none      pre-0.7.0, no longer read; any other value is a problem
import type { ForgeConfig } from './config';

export type Worktrees = { install: string | null; problems: string[] };

export const DEPENDENCY_DIR_PROBLEM =
  'worktrees: dependency_dir is no longer read (0.7.0): slice worktrees get a real install, never a symlink. ' +
  'Set `- install: <command>` under ## Worktrees (or `- install: none`) and set dependency_dir to none or drop it';

export function parseWorktrees(config: ForgeConfig | undefined): Worktrees {
  const section = config?.worktrees ?? {};
  const install = section.install?.trim() ?? '';
  const dependencyDir = section.dependency_dir?.trim() ?? '';
  return {
    install: install && install.toLowerCase() !== 'none' ? install : null,
    problems: dependencyDir && dependencyDir.toLowerCase() !== 'none' ? [DEPENDENCY_DIR_PROBLEM] : [],
  };
}
