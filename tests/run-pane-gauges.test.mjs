// The gauges' colours (hooks/run-pane/gauges.ts): ctx turns red at 40%, the
// session and week windows at 75%, each yellow two-thirds of the way there.
// Node strips the module's types on import.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { tone, untilReset } = await import('../plugins/forge-sdlc/hooks/run-pane/gauges.ts');

test('ctx is green under 27%, yellow from 27%, red from 40%', () => {
  assert.equal(tone('ctx', 26), 'success');
  assert.equal(tone('ctx', 27), 'warning');
  assert.equal(tone('ctx', 39), 'warning');
  assert.equal(tone('ctx', 40), 'error');
});

test('the session and week windows are green under 50%, yellow from 50%, red from 75%', () => {
  for (const gauge of ['five_hour', 'seven_day']) {
    assert.equal(tone(gauge, 49), 'success', gauge);
    assert.equal(tone(gauge, 50), 'warning', gauge);
    assert.equal(tone(gauge, 74.9), 'warning', gauge);
    assert.equal(tone(gauge, 75), 'error', gauge);
  }
});

test('an unknown percent has no colour', () => {
  assert.equal(tone('ctx', undefined), undefined);
});

test('a reset reads as days and hours, hours and minutes, or minutes', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  assert.equal(untilReset('2026-01-04T06:00:00.000Z', now), '3d 6h');
  assert.equal(untilReset('2026-01-01T02:15:00.000Z', now), '2h 15m');
  assert.equal(untilReset('2026-01-01T00:40:00.000Z', now), '40m');
  assert.equal(untilReset(undefined, now), undefined);
});
