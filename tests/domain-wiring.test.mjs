// Focused extraction checks. The existing 19 engine golden cases remain
// unchanged; WP1.6 owns the expanded domain scenario suite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { buildLegacyBundle, bundledApp } from '../src/domain/build-legacy.mjs';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const domain = () => vm.runInNewContext(buildLegacyBundle() + '\nMomentumDomain;');

test('checked-in classic domain bundle matches the TypeScript source exactly', () => {
  assert.equal(
    source,
    bundledApp(source),
    'Run node src/domain/build-legacy.mjs before committing',
  );
});

test('pure domain initializes and runs without window, DOM, storage, network or an ambient clock', () => {
  const api = domain();
  const questions = [{ key: 'sleep', text: 'Sleep', tier: 'S', polarity: 'positive' }];
  assert.equal(api.runEngine(questions, { sleep: 3 }, 100, 0, 0).newVelocity, 108);
  assert.equal(
    api.recomputeAll(questions, [{ date: '2026-06-01', answers: { sleep: 3 } }])['2026-06-01']
      .computed.newVelocity,
    108,
  );
  assert.equal(api.checkBalance([]).reason, 'No questions.');
  api.validateQuestionText({ text: 'Habit', opts: ['Low', 'Mid', 'High'] });
  assert.equal(
    api.parseDraft(
      JSON.stringify({ version: 1, userId: 'A', date: '2026-06-01', answers: { sleep: 3 } }),
      'A',
      '2026-06-01',
    ).sleep,
    3,
  );
});

test('date modules take an explicit timezone independently of the device zone', () => {
  const api = domain(),
    instant = new Date('2026-09-04T19:00:00Z');
  assert.equal(api.localDateKey(instant, 'Asia/Kolkata'), '2026-09-05');
  assert.equal(api.localDateKey(instant, 'America/Los_Angeles'), '2026-09-04');
  assert.equal(
    api.calendarDate('2026-09-05', 'Asia/Kolkata').getTime(),
    Date.parse('2026-09-05T06:30:00Z'),
  );
  assert.equal(
    api.calendarDate('2026-03-08', 'America/New_York').getTime(),
    Date.parse('2026-03-08T16:00:00Z'),
  );
  assert.equal(api.dateKeyOffset(new Date('2024-03-01T00:00:00Z'), -1, 'UTC'), '2024-02-29');
  assert.equal(
    api.dateKeyOffset(new Date('2026-03-08T07:30:00Z'), -1, 'America/New_York'),
    '2026-03-07',
  );
});

test('history/scoring receive independent question sets and leave caller input untouched', () => {
  const api = domain();
  const question = Object.freeze({ key: 'habit', text: 'Habit', tier: 'S', polarity: 'positive' });
  const answers = Object.freeze({ habit: 3 });
  const rows = Object.freeze([Object.freeze({ date: '2026-06-01', answers })]);
  assert.equal(
    api.recomputeAll(Object.freeze([question]), rows)['2026-06-01'].computed.newVelocity,
    108,
  );
  assert.equal(
    api.recomputeAll([{ ...question, tier: 'B' }], rows)['2026-06-01'].computed.newVelocity,
    103,
  );
  assert.equal(question.tier, 'S');
  assert.equal(answers.habit, 3);
});
