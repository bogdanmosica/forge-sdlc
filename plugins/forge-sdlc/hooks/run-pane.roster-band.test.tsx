// The roster's problems in the band above the prompt, through `claude plugin
// test`: docs/agents/forge.yaml and forge.md's deprecated sections read at each
// refresh, each problem toasted the first time it is seen and kept in the band
// while it lasts. The stand-in host is run-pane.fixture.tsx's.
import { test, expect, mock } from 'claude-code/testing';
import { HOST_CONFIG, band, forgeConfig, seat, start } from './run-pane.fixture';

const ROSTER = 'docs/agents/forge.yaml';

test('a bad roster entry is toasted once and kept in the band while it stays bad', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, {
    files: {
      [HOST_CONFIG]: forgeConfig(),
      [ROSTER]: 'version: 1\nroles:\n  reviewer:\n    effort: extreme\n',
    },
  });
  await start($, clock);
  await clock.advance(5000);
  await clock.advance(5000);
  const said = s.toasts.filter((t) => t.includes('roles.reviewer.effort'));
  expect(said).toEqual([
    'forge-sdlc: roster: roles.reviewer.effort "extreme" is not low|medium|high|xhigh|max; ignored',
  ]);
  expect(await band($)).toContain('roster: roles.reviewer.effort "extreme" is not low|medium|high|xhigh|max; ignored');

  // fixed: the note leaves the band and nothing more is said
  s.files[ROSTER] = 'version: 1\nroles:\n  reviewer:\n    effort: high\n';
  await clock.advance(5000);
  expect(await band($)).not.toContain('roster');
  expect(s.toasts.filter((t) => t.includes('roster'))).toHaveLength(1);
});
