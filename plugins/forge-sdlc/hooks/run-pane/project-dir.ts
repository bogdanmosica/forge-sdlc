// The project dir whose `.forge/` holds the run state: the host bin/host-dir.mjs
// prints for the session's directory, resolved by hostDirOf as the hooks resolve it,
// so a subfolder host (a monorepo's projects/<x>) reads its own state and a session
// in a slice worktree its host's; the session's directory outside git or when
// node cannot run. Shared by the run pane (run-pane.tsx) and the /forge loop tab (forge.tsx).
import type { EngineInterface } from 'claude-code';

export async function projectDir($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd();
  try {
    const ran = await $.process.run(['node', `${$.plugin.root}/bin/host-dir.mjs`, cwd], { timeoutMs: 5000 });
    if (ran.exitCode === 0 && ran.stdout.trim()) return ran.stdout.trim();
  } catch {
    /* node did not run: the session's directory is the project */
  }
  return cwd;
}
