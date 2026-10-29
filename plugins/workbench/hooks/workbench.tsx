// The workbench mod: the cmux-config views rebuilt inside Claude Code. The
// session store (sessions.ts) and each view register their own hooks; the two
// events several parts need, session.start and turn.complete, are hooked here
// once, since a plugin may hook an event only once without a matcher.
import type { Register } from 'claude-code';
import { finishTurn, registerSessions, startSession } from './sessions';
import { refreshFocus, registerFocus, startFocus } from './focus';
import { refreshBoards, registerBoards, startBoards } from './boards';
import { registerBand } from './band';
import { registerCommands, startCommands } from './commands';

export const register: Register = (on) => {
  registerSessions(on);
  registerFocus(on);
  registerBoards(on);
  registerBand(on);
  registerCommands(on);

  on('session.start', async ($, e, next) => {
    const started = await next(e);
    await startSession($);
    await startFocus($);
    await startBoards($);
    await startCommands($);
    return started;
  });

  on('turn.complete', async ($, e, next) => {
    const done = await next(e);
    if (!e.agentId) {
      // a subagent's turn leaves the session working
      await finishTurn($, e.answer);
      await refreshFocus($);
      await refreshBoards($);
    }
    return done;
  });
};
