// The workbench mod: the cmux-config views rebuilt inside Claude Code. The
// session store (sessions.ts) and each view register their own matched hooks
// through registerWorkbench; the four unmatched events several parts need,
// session.start, prompt.submit, turn.step and turn.complete, are hooked once
// here, since a plugin may hook an event only once without a matcher. A plugin
// that already holds one of them (emag-sdlc's run pane holds all four) calls
// registerWorkbench and the four functions below from its own hooks instead
// of using `register`.
import type { EngineInterface, On, Register, TurnCompleteInput, TurnStepResult } from 'claude-code';
import { finishTurn, notePrompt, registerSessionPrompt, registerSessions, startSession } from './sessions';
import { noteStep, refreshFocus, registerFocus, registerFocusStep, startFocus } from './focus';
import { refreshBoards, registerBoards, startBoards } from './boards';
import { registerBand } from './band';
import { registerCommands, startCommands } from './commands';

// The matched hooks, and the band (first, so its rows sit above the plugin's
// own band: the first band hook registered is the outermost).
export function registerWorkbench(on: On) {
  registerBand(on);
  registerSessions(on);
  registerFocus(on);
  registerBoards(on);
  registerCommands(on);
}

// On session.start, after `next`: this session's record, the panes' commands
// and their refresh timers.
export async function startWorkbench($: EngineInterface) {
  await startSession($);
  await startFocus($);
  await startBoards($);
  await startCommands($);
}

// On prompt.submit: the session is working on this prompt. (Each export is a
// function of its own: the loader refuses an exported alias of another.)
export async function noteWorkbenchPrompt($: EngineInterface, e: { text: string; isMeta?: boolean }) {
  await notePrompt($, e);
}

// On turn.step, with the step `next` answered: the prompt cache's state.
export async function noteWorkbenchStep(
  $: EngineInterface,
  e: { agentId?: string },
  step: Pick<TurnStepResult, 'usage'>,
) {
  await noteStep($, e, step);
}

// On turn.complete, after `next`: a main-thread turn marks the session idle
// and refreshes the panes; a subagent's turn leaves it working.
export async function completeWorkbenchTurn($: EngineInterface, e: Pick<TurnCompleteInput, 'agentId' | 'answer'>) {
  if (e.agentId) return;
  await finishTurn($, e.answer);
  await refreshFocus($);
  await refreshBoards($);
}

export const register: Register = (on) => {
  registerWorkbench(on);
  registerSessionPrompt(on);
  registerFocusStep(on);

  on('session.start', async ($, e, next) => {
    const started = await next(e);
    await startWorkbench($);
    return started;
  });

  on('turn.complete', async ($, e, next) => {
    const done = await next(e);
    await completeWorkbenchTurn($, e);
    return done;
  });
};
