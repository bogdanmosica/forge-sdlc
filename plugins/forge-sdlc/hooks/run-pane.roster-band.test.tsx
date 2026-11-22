// The roster's problems in the band above the prompt, through `claude plugin
// test`: docs/agents/forge.yaml and forge.md's deprecated sections read at each
// refresh, each problem toasted the first time it is seen and kept in the band
// while it lasts. The stand-in host is run-pane.fixture.tsx's.
import { test, expect, mock } from 'claude-code/testing';
import type { AgentSpawnInput } from 'claude-code';
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

test('## Routing bullets and ## Policy skills are toasted as deprecated, each naming forge.yaml and the key to move', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, {
    files: {
      [HOST_CONFIG]: forgeConfig(
        '\n## Routing\n- model.researcher: haiku\n- effort.Explore: low\n\n## Policy skills\n- skills: writing-for-agents\n',
      ),
    },
  });
  await start($, clock);
  const said = s.toasts.join('\n');
  expect(said).toContain(
    '## Routing: model.researcher is deprecated; move it to roles.researcher.model in docs/agents/forge.yaml',
  );
  expect(said).toContain(
    '## Routing: effort.Explore is deprecated and has no docs/agents/forge.yaml equivalent; it stops working when ## Routing is removed',
  );
  expect(said).toContain('## Policy skills: skills is deprecated; move it to slots.policy in docs/agents/forge.yaml');
  const shown = await band($);
  expect(shown).toContain('move it to roles.researcher.model in docs/agents/forge.yaml');
  expect(shown).toContain('move it to slots.policy in docs/agents/forge.yaml');
  // said once, however many refreshes follow
  const count = s.toasts.length;
  await clock.advance(5000);
  expect(s.toasts).toHaveLength(count);
});

test('an empty ## Routing and ## Policy skills of none say nothing', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, {
    files: { [HOST_CONFIG]: forgeConfig('\n## Routing\n\n## Policy skills\n- skills: none\n') },
  });
  await start($, clock);
  await clock.advance(5000);
  expect(s.toasts.filter((t) => t.includes('deprecated'))).toEqual([]);
  expect(await band($)).not.toContain('deprecated');
});

test('an invalid ## Routing value shows once in the band, as the routing note, beside its deprecation', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, { files: { [HOST_CONFIG]: forgeConfig('\n## Routing\n- model.researcher: sonet-5\n') } });
  await start($, clock);
  const shown = await band($);
  expect(shown.match(/sonet-5/g)).toHaveLength(1);
  expect(shown).toContain('routing ignored: model.researcher "sonet-5" is no model alias or claude-* id');
  expect(shown).toContain('## Routing: model.researcher is deprecated; move it to roles.researcher.model');
  expect(s.toasts.join('\n').match(/sonet-5/g)).toHaveLength(1);
});

test('a swap target not offered joins the roster note at the first spawn and leaves it once fixed', async ($, on) => {
  const clock = mock.clock(on);
  const s = seat(on, {
    files: {
      [HOST_CONFIG]: forgeConfig(),
      [ROSTER]: 'version: 1\nroles:\n  reviewer:\n    agent: ghost-plugin:reviewer\n',
    },
  });
  on('agent.offer', () => ({ isOffered: true }));
  on('agent.spawn', ($, e) => ({ model: e.parentModel, agentId: 'agent-9' }));
  await start($, clock);
  // before any spawn no listing has offered anything: nothing is reported yet
  expect(await band($)).not.toContain('names no offered agent');
  await $.agent.offer({ agent: 'forge-sdlc:reviewer', description: 'the reviewer', source: 'plugin', provider: { plugin: 'x', tier: 'user' } });
  await $.agent.spawn({
    tool_use_id: 'toolu_1',
    prompt: 'Review slice 03.',
    description: 'review slice 03',
    subagentType: 'forge-sdlc:reviewer',
    provider: { plugin: 'forge-sdlc', tier: 'user' },
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  } as AgentSpawnInput);
  const line = 'roster: roles.reviewer.agent "ghost-plugin:reviewer" names no offered agent; forge-sdlc:reviewer spawns';
  await clock.advance(5000);
  expect(await band($)).toContain(line);
  expect(s.toasts.filter((t) => t.includes('names no offered agent'))).toEqual([`forge-sdlc: ${line}`]);

  s.files[ROSTER] = 'version: 1\n';
  await clock.advance(5000);
  expect(await band($)).not.toContain('roster');
});
