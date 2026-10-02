import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildLegacyBundle } from '../src/domain/build-legacy.mjs';
const api = vm.runInNewContext(buildLegacyBundle() + '\nMomentumDomain;');
const plain = (value) => JSON.parse(JSON.stringify(value));
const q = (key, polarity = 'positive', tier = 'S') => ({ key, text: key, polarity, tier });
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/engine-b-1.json', import.meta.url), 'utf8'),
);
for (const example of fixture.cases) {
  test(`Engine b-1 fixture ${example.id}: ${example.description}`, () => {
    const result = api.runEngine(
      example.questions,
      example.answers,
      example.previousVelocity,
      example.priorPositive,
      example.priorNegative,
      example.options,
    );
    assert.equal(result.engineVersion, fixture.engineVersion);
    for (const [field, value] of Object.entries(example.expected))
      assert.deepEqual(result[field], value, field);
  });
}
for (const example of fixture.trajectoryCases) {
  test(`Engine b-1 fixture ${example.id}: supplied raw change/single floor`, () => {
    // Corrected ENGINE E7 (Oscar d30afcc): raw -10 ×1.15 rounds to -12.
    // Daily and trajectory fixtures share the same single-floor outcome.
    assert.deepEqual(
      plain(api.applyVelocityChange(example.previousVelocity, example.rawChange, example.shadow)),
      example.expected,
    );
  });
}
test('b-1 rounding is symmetric on ties, rejects nonfinite values and has no negative zero', () => {
  for (const [input, output] of [
    [2.5, 3],
    [-2.5, -3],
    [1.5, 2],
    [-1.5, -2],
    [-2.49, -2],
    [0, 0],
    [-0, 0],
    [-0.1, 0],
  ])
    assert.equal(api.roundHalfAwayFromZero(input), output);
  for (const value of [NaN, Infinity, -Infinity])
    assert.throws(() => api.roundHalfAwayFromZero(value));
});
test('only numeric due answers count; null, invalid, orphans and excused states stay distinct', () => {
  const questions = [q('a'), q('b'), q('c')];
  for (const bad of ['3', 'garbage', '0', 0, 4, 999, NaN, Infinity, true, {}, []]) {
    const e = api.assessEligibility(
      questions,
      { a: 3, b: bad, removed: 3 },
      { dueKeys: ['a', 'b'] },
    );
    assert.equal(e.answeredCount, 1);
    assert.equal(e.partial, true);
    assert.equal(e.eligible, false);
    assert.equal(e.answerStates.b, 'invalid');
    assert.equal(e.answerStates.c, undefined);
  }
  const resolved = api.runEngine(questions, { a: 3, b: null, c: 1, removed: 3 }, 100, 0, 0, {
    dueKeys: ['a', 'b'],
    excusedKeys: ['b'],
  });
  assert.equal(resolved.eligible, true);
  assert.equal(resolved.answeredCount, 1);
  assert.equal(resolved.excusedCount, 1);
  assert.equal(resolved.thrust, 8);
  assert.equal(resolved.drag, 0);
  assert.equal(resolved.answerStates.b, 'excused');
});
test('explicit drafts and no-due/reflection-only days publish no score or shadow', () => {
  for (const options of [{ finalized: false }, { dueKeys: [] }]) {
    const r = api.runEngine([q('sleep')], { sleep: 3 }, 42, 2, 1, { ...options, shadow: 9 });
    assert.equal(r.eligible, false);
    assert.equal(r.newVelocity, 42);
    assert.equal(r.rawChange, 0);
    assert.equal(r.shadow, 0);
    assert.equal(r.posStreak, 2);
    assert.equal(r.negStreak, 1);
  }
});
test('calendar shadow handles leap/year/DST keys; pending predecessors supply no drag', () => {
  for (const [day, prior] of [
    ['2024-03-01', '2024-02-29'],
    ['2026-01-01', '2025-12-31'],
    ['2026-03-09', '2026-03-08'],
  ]) {
    assert.equal(api.calendarKeyOffset(day, -1), prior);
    const cache = api.recomputeAll(
      [q('vice', 'negative')],
      [
        { date: prior, answers: { vice: 1 } },
        { date: day, answers: { vice: 3 } },
      ],
    );
    assert.equal(cache[day].computed.shadow, 3);
  }
  const rows = [
    { date: '2026-06-01', answers: { a: 1, b: null } },
    { date: '2026-06-02', answers: { a: 3, b: 3 } },
  ];
  const result = api.recomputeAll([q('a', 'negative'), q('b')], rows)['2026-06-02'].computed;
  assert.equal(result.shadow, 0);
  assert.equal(result.newVelocity, 108);
  assert.throws(() => api.calendarKeyOffset('2026-02-30', -1));
});
test('shadow can reverse positive raw intent; streaks use the final actual change', () => {
  const cache = api.recomputeAll(
    [q('build', 'positive', 'B'), q('vice', 'negative')],
    [
      { date: '2026-06-01', answers: { build: 2, vice: 1 } },
      { date: '2026-06-02', answers: { build: 2, vice: 1 } },
      { date: '2026-06-03', answers: { build: 3, vice: 3 } },
    ],
  );
  const c = cache['2026-06-03'].computed;
  assert.equal(c.rawDv, 3);
  assert.equal(c.mult, 1);
  assert.equal(c.rawChange, 3);
  assert.equal(c.shadow, 4);
  assert.equal(c.intendedChange, -1);
  assert.equal(c.actualChange, -1);
  assert.equal(c.posStreak, 0);
  assert.equal(c.negStreak, 3);
});
test('negative intent at the zero floor shows zero loss and resets both engine streaks', () => {
  const c = api.runEngine([q('vice', 'negative')], { vice: 1 }, 0, 0, 4, { shadow: 3 });
  assert(c.intendedChange < 0);
  assert.equal(c.newVelocity, 0);
  assert.equal(c.actualChange, 0);
  assert.equal(c.finalDv, 0);
  assert.equal(c.posStreak, 0);
  assert.equal(c.negStreak, 0);
});
test('E5 backfill replays the suffix deterministically in calendar position', () => {
  const questions = [q('vice', 'negative')];
  const before = [
    { date: '2026-06-01', answers: { vice: 1 } },
    { date: '2026-06-03', answers: { vice: 3 } },
  ];
  const filled = [...before, { date: '2026-06-02', answers: { vice: 1 } }];
  const a = api.recomputeAll(questions, before),
    b = api.recomputeAll(questions, filled);
  assert.equal(a['2026-06-03'].computed.shadow, 1);
  assert.equal(b['2026-06-03'].computed.shadow, 4);
  assert.notEqual(a['2026-06-03'].computed.newVelocity, b['2026-06-03'].computed.newVelocity);
  assert.deepEqual(plain(api.recomputeAll(questions, filled)), plain(b));
});
test('Variant1 carries velocity, resets gap streaks and creates no synthetic rows', () => {
  const rows = [
    { date: '2026-05-01', answers: { sleep: 3 } },
    { date: '2026-06-01', answers: { sleep: 3 } },
  ];
  const cache = api.recomputeAll([q('sleep')], rows);
  assert.equal(cache['2026-06-01'].computed.posStreak, 1);
  assert.equal(cache['2026-06-01'].computed.newVelocity, 116);
  assert.deepEqual(Object.keys(cache), ['2026-05-01', '2026-06-01']);
});

test('an unfinished today keeps continuity until that local day closes', () => {
  const rows = [
    { date: '2026-06-01', answers: { sleep: 3 } },
    { date: '2026-06-02', answers: { sleep: null } },
  ];
  const current = api.recomputeAll([q('sleep')], rows, { todayKey: '2026-06-02' });
  const closed = api.recomputeAll([q('sleep')], rows, { todayKey: '2026-06-03' });
  assert.equal(current['2026-06-02'].computed.posStreak, 1);
  assert.equal(closed['2026-06-02'].computed.posStreak, 0);
  assert.equal(current['2026-06-02'].computed.newVelocity, 108);
  assert.equal(closed['2026-06-02'].computed.newVelocity, 108);
});

test('closed no-action/excused/draft days carry velocity but reset multiplier continuity', () => {
  for (const row of [
    { date: '2026-06-02', answers: {}, dueKeys: [] },
    { date: '2026-06-02', answers: {}, excusedKeys: ['sleep'] },
    { date: '2026-06-02', answers: { sleep: 3 }, finalized: false },
  ]) {
    const cache = api.recomputeAll(
      [q('sleep')],
      [
        { date: '2026-06-01', answers: { sleep: 3 } },
        row,
        { date: '2026-06-03', answers: { sleep: 3 } },
      ],
      { todayKey: '2026-06-03' },
    );
    assert.equal(cache['2026-06-02'].computed.newVelocity, 108);
    assert.equal(cache['2026-06-02'].computed.posStreak, 0);
    assert.equal(cache['2026-06-03'].computed.mult, 1);
    assert.equal(cache['2026-06-03'].computed.posStreak, 1);
  }
});

test('one missed closed day resets positive and negative continuity without decay', () => {
  const positive = api.recomputeAll(
    [q('sleep')],
    [
      { date: '2026-06-01', answers: { sleep: 3 } },
      { date: '2026-06-03', answers: { sleep: 3 } },
    ],
  );
  assert.equal(positive['2026-06-03'].computed.mult, 1);
  assert.equal(positive['2026-06-03'].computed.newVelocity, 116);
  const negative = api.recomputeAll(
    [q('vice', 'negative')],
    [
      { date: '2026-06-01', answers: { vice: 1 } },
      { date: '2026-06-03', answers: { vice: 1 } },
    ],
  );
  assert.equal(negative['2026-06-03'].computed.mult, 1.15);
  assert.equal(negative['2026-06-03'].computed.negStreak, 1);
  assert.equal(negative['2026-06-03'].computed.shadow, 1);
});
