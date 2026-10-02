// WP1.6 — expanded scenario suite for the pure domain modules (src/domain/*.ts).
//
// Complements (does not replace) tests/engine.characterization.test.mjs, which
// pins the classic app via the generated bundle. This suite exercises the TS
// modules themselves across a wide input matrix.
//
// Labels match the characterization file:
//   [CURRENT-BEHAVIOR] — intended behavior worth locking in.
//   [KNOWN-BUG: AUDIT-NN] — a defect from docs/.../AUDIT.md; the assertion
//     captures the WRONG output on purpose. Fixing the bug should fail the test,
//     at which point it is updated deliberately.
//
// Loading: scoring/validation/dates are self-contained and imported directly as
// .ts (Node 24 strips types). history.ts uses an extensionless internal import
// (`./scoring`) that Node's native resolver does not follow, so history is loaded
// through the same generated bundle the app ships — i.e. the real transpiled
// history.ts. No new dependencies; runs under `npm test` (node --test).

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { scoreForAnswer, runEngine, TIER_WEIGHTS } from '../src/domain/scoring.ts';
import {
  validateQuestionText,
  checkBalance,
  parseDraft,
  QUESTION_TEXT_LIMIT,
  OPTION_TEXT_LIMIT,
  MIN_TOTAL_QUESTIONS,
} from '../src/domain/validation.ts';
import { localDateKey, calendarDate, dateKeyOffset } from '../src/domain/dates.ts';
import { buildLegacyBundle } from '../src/domain/build-legacy.mjs';

// history via the generated bundle (see header note).
const MomentumDomain = vm.runInNewContext(buildLegacyBundle() + '\nMomentumDomain;');
const recomputeAll = MomentumDomain.recomputeAll;

const q = (key, polarity, tier) => ({ key, text: key, polarity, tier });

// ───────────────────────────── scoreForAnswer ─────────────────────────────

test('[CURRENT-BEHAVIOR] scoreForAnswer: full polarity × tier × value matrix', () => {
  const expected = {
    positive: { S: [-5, 0, 8], A: [-3, 0, 5], B: [-1.5, 0, 3] },
    negative: { S: [-10, -4, 0], A: [-6, -2, 0], B: [-3, -1, 0] },
  };
  for (const polarity of ['positive', 'negative']) {
    for (const tier of ['S', 'A', 'B']) {
      for (let idx = 0; idx < 3; idx++) {
        assert.equal(
          scoreForAnswer(q('k', polarity, tier), idx),
          expected[polarity][tier][idx],
          `${polarity}/${tier}/${idx}`,
        );
      }
    }
  }
});

test('[CURRENT-BEHAVIOR] scoreForAnswer: index clamps to 0..2; unknown polarity→positive, unknown tier→B', () => {
  assert.equal(scoreForAnswer(q('k', 'positive', 'A'), 9), 5); // clamp high → good
  assert.equal(scoreForAnswer(q('k', 'positive', 'A'), -4), -3); // clamp low → bad
  assert.equal(scoreForAnswer(q('k', 'zzz', 'S'), 2), 8); // unknown polarity → positive table
  assert.equal(scoreForAnswer(q('k', 'positive', 'Z'), 0), -1.5); // unknown tier → B
  assert.equal(TIER_WEIGHTS.positive.S.good, 8); // weights table intact
});

// ───────────────────────────── runEngine ─────────────────────────────

test('[CURRENT-BEHAVIOR] runEngine: positive-streak multiplier curve (rawDv>0), capped at 2.2', () => {
  const m = ps => runEngine([q('k', 'positive', 'S')], { k: 3 }, 100, ps, 0).mult;
  assert.equal(m(0), 1);
  assert.equal(m(1), 1.29);
  assert.equal(m(3), 1.59);
  assert.equal(m(10), 2.02);
  assert.equal(m(20), 2.2); // cap
});

test('[CURRENT-BEHAVIOR] runEngine: negative-streak multiplier curve (rawDv<0), capped at 3.5', () => {
  const m = ns => runEngine([q('k', 'negative', 'S')], { k: 1 }, 100, 0, ns).mult;
  assert.equal(m(0), 1.15);
  assert.equal(m(1), 1.4);
  assert.equal(m(3), 2.04);
  assert.equal(m(10), 3.5); // cap
});

test('[CURRENT-BEHAVIOR] runEngine: velocity never goes below 0', () => {
  // One S-negative "bad" from a low start would go negative; floored at 0.
  const r = runEngine([q('k', 'negative', 'S')], { k: 1 }, 3, 0, 0);
  assert.ok(r.finalDv < 0);
  assert.equal(r.newVelocity, 0);
});

test('[CURRENT-BEHAVIOR] runEngine: null/undefined answers are skipped; thrust/drag items populated', () => {
  const qs = [q('a', 'positive', 'S'), q('b', 'negative', 'S')];
  const r = runEngine(qs, { a: 3, b: null }, 100, 0, 0);
  assert.equal(r.thrust, 8);
  assert.equal(r.drag, 0);
  assert.deepEqual(r.thrustItems, [{ name: 'a', score: 8 }]);
  assert.equal(runEngine(qs, {}, 100, 0, 0).rawDv, 0);
});

test('[KNOWN-BUG: AUDIT-11] runEngine: non-numeric→worst option, "0"→"1", out-of-range→best', () => {
  const qs = [q('k', 'positive', 'S')];
  assert.equal(runEngine(qs, { k: 'garbage' }, 100, 0, 0).drag, 5); // NaN||1 → idx0 (bad)
  assert.equal(runEngine(qs, { k: '0' }, 100, 0, 0).drag, 5); // 0||1 → idx0 (bad)
  assert.equal(runEngine(qs, { k: 999 }, 100, 0, 0).thrust, 8); // clamp → idx2 (good)
});

// ───────────────────────────── recomputeAll (history) ─────────────────────────────

test('[CURRENT-BEHAVIOR] recomputeAll: first day from velocity 100, no shadow', () => {
  const c = recomputeAll([q('k', 'positive', 'S')], [{ date: '2026-06-01', answers: { k: 3 } }])['2026-06-01'];
  assert.equal(c.computed.newVelocity, 108);
  assert.equal(c.computed.shadow, 0);
  assert.equal(c.partial, false);
  assert.equal(c.answeredCount, 1);
});

test('[CURRENT-BEHAVIOR] recomputeAll: velocity floored at 0 over a long bad run', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ date: `2026-06-0${i + 1}`, answers: { k: 1 } }));
  assert.equal(recomputeAll([q('k', 'negative', 'S')], rows)['2026-06-07'].computed.newVelocity, 0);
});

test('[CURRENT-BEHAVIOR] recomputeAll: shadow drag accrues from the two most recent entries', () => {
  const cache = recomputeAll([q('k', 'negative', 'S')], [
    { date: '2026-06-01', answers: { k: 1 } },
    { date: '2026-06-02', answers: { k: 1 } },
    { date: '2026-06-03', answers: { k: 3 } },
  ]);
  assert.equal(cache['2026-06-02'].computed.shadow, 3); // round(0.5 * 0.6*10)
  assert.equal(cache['2026-06-03'].computed.shadow, 4); // round(0.5 * (0.6*10 + 0.24*10))
});

test('[CURRENT-BEHAVIOR] recomputeAll: a genuinely incomplete day is marked partial', () => {
  const c = recomputeAll([q('a', 'positive', 'S'), q('b', 'positive', 'S')], [
    { date: '2026-06-01', answers: { a: 3 } },
  ])['2026-06-01'];
  assert.equal(c.partial, true);
  assert.equal(c.answeredCount, 1);
});

test('[KNOWN-BUG: AUDIT-10] recomputeAll: a month gap still yields a 2-day streak and keeps shadow', () => {
  const streak = recomputeAll([q('k', 'positive', 'S')], [
    { date: '2026-05-01', answers: { k: 3 } },
    { date: '2026-06-01', answers: { k: 3 } },
  ])['2026-06-01'].computed.posStreak;
  assert.equal(streak, 2);
  const shadow = recomputeAll([q('k', 'positive', 'S')], [
    { date: '2026-05-01', answers: { k: 1 } },
    { date: '2026-06-01', answers: { k: 3 } },
  ])['2026-06-01'].computed.shadow;
  assert.equal(shadow, 2);
});

test('[KNOWN-BUG: AUDIT-11] recomputeAll: null answer counts as complete; orphan key inflates count', () => {
  const nullDay = recomputeAll([q('k', 'positive', 'S')], [{ date: '2026-06-01', answers: { k: null } }])['2026-06-01'];
  assert.equal(nullDay.partial, false); // null !== undefined → counted
  assert.equal(nullDay.computed.thrust, 0); // ...but scores nothing
  const orphan = recomputeAll([q('a', 'positive', 'S'), q('b', 'positive', 'S')], [
    { date: '2026-06-01', answers: { a: 3, removed: 3 } },
  ])['2026-06-01'];
  assert.equal(orphan.answeredCount, 2);
  assert.equal(orphan.partial, false);
});

test('[KNOWN-BUG: AUDIT-05] recomputeAll: retiering rewrites an already-saved day (108→103)', () => {
  const rows = [{ date: '2026-06-01', answers: { k: 3 } }];
  assert.equal(recomputeAll([q('k', 'positive', 'S')], rows)['2026-06-01'].computed.newVelocity, 108);
  assert.equal(recomputeAll([q('k', 'positive', 'B')], rows)['2026-06-01'].computed.newVelocity, 103);
});

test('[CURRENT-BEHAVIOR] recomputeAll: rows with no answers are skipped; input is not mutated', () => {
  const question = Object.freeze(q('k', 'positive', 'S'));
  const answers = Object.freeze({ k: 3 });
  const rows = Object.freeze([
    Object.freeze({ date: '2026-06-02', answers }),
    Object.freeze({ date: '2026-06-01', answers: null }),
  ]);
  const cache = recomputeAll(Object.freeze([question]), rows);
  assert.equal(cache['2026-06-01'], undefined); // null-answers row skipped
  assert.equal(cache['2026-06-02'].computed.newVelocity, 108);
  assert.equal(answers.k, 3); // caller input untouched
});

// ───────────────────────────── dates (explicit timezone) ─────────────────────────────

test('[CURRENT-BEHAVIOR] localDateKey: honors the given IANA zone, not the device', () => {
  const instant = new Date('2026-09-04T19:00:00Z');
  assert.equal(localDateKey(instant, 'Asia/Kolkata'), '2026-09-05'); // +05:30 → next day
  assert.equal(localDateKey(instant, 'America/Los_Angeles'), '2026-09-04'); // −07:00 → same day
  assert.equal(localDateKey(instant, 'UTC'), '2026-09-04');
});

test('[CURRENT-BEHAVIOR] localDateKey: invalid Date preserves legacy sentinel for demo validation', () => {
  assert.equal(localDateKey(new Date('not-a-date'), 'UTC'), '0NaN-NaN-NaN');
});

test('[CURRENT-BEHAVIOR] calendarDate: local noon maps across DST (spring-forward and fall-back)', () => {
  // US Eastern: 2026-03-08 is spring-forward (EDT, −04:00), 2026-11-01 is fall-back (EST, −05:00).
  assert.equal(calendarDate('2026-03-08', 'America/New_York').getTime(), Date.parse('2026-03-08T16:00:00Z'));
  assert.equal(calendarDate('2026-11-01', 'America/New_York').getTime(), Date.parse('2026-11-01T17:00:00Z'));
  assert.equal(calendarDate('2026-09-05', 'Asia/Kolkata').getTime(), Date.parse('2026-09-05T06:30:00Z'));
});

test('[CURRENT-BEHAVIOR] calendarDate/localDateKey round-trip holds through DST and across zones', () => {
  for (const [key, tz] of [
    ['2026-03-08', 'America/Los_Angeles'],
    ['2026-11-01', 'America/New_York'],
    ['2026-09-05', 'Asia/Kolkata'],
    ['2026-01-01', 'UTC'],
  ]) {
    assert.equal(localDateKey(calendarDate(key, tz), tz), key, `${key}/${tz}`);
  }
});

test('[CURRENT-BEHAVIOR] dateKeyOffset: year boundary and leap day in both directions', () => {
  assert.equal(dateKeyOffset(new Date('2026-01-01T12:00:00Z'), -1, 'UTC'), '2025-12-31');
  assert.equal(dateKeyOffset(new Date('2024-02-29T12:00:00Z'), 1, 'UTC'), '2024-03-01'); // leap → March
  assert.equal(dateKeyOffset(new Date('2024-03-01T12:00:00Z'), -1, 'UTC'), '2024-02-29'); // back to leap day
  assert.equal(dateKeyOffset(new Date('2023-03-01T12:00:00Z'), -1, 'UTC'), '2023-02-28'); // non-leap
  // Near a DST boundary, a −1 day offset still lands on the previous calendar day.
  assert.equal(dateKeyOffset(new Date('2026-03-08T07:30:00Z'), -1, 'America/New_York'), '2026-03-07');
});

// ───────────────────────────── validation ─────────────────────────────

test('[CURRENT-BEHAVIOR] validateQuestionText: accepts valid, rejects bad text/options', () => {
  assert.doesNotThrow(() => validateQuestionText({ text: 'Habit', opts: ['Low', 'Mid', 'High'] }));
  assert.throws(() => validateQuestionText({ text: '', opts: ['a', 'b', 'c'] }), /1–80/);
  assert.throws(() => validateQuestionText({ text: '   ', opts: ['a', 'b', 'c'] }), /1–80/);
  assert.throws(() => validateQuestionText({ text: 'x'.repeat(QUESTION_TEXT_LIMIT + 1), opts: ['a', 'b', 'c'] }), /1–80/);
  assert.throws(() => validateQuestionText({ text: 'ok', opts: ['a', 'b'] }), /three option/);
  assert.throws(() => validateQuestionText({ text: 'ok', opts: ['a', '', 'c'] }), /three option/);
  assert.throws(() => validateQuestionText({ text: 'ok', opts: ['a', 'b', 'x'.repeat(OPTION_TEXT_LIMIT + 1)] }), /three option/);
  assert.throws(() => validateQuestionText({ text: 'ok', opts: 'abc' }), /three option/);
});

test('[CURRENT-BEHAVIOR] checkBalance: thresholds for count and polarity ratio', () => {
  assert.deepEqual(checkBalance([]).reason, 'No questions.');
  assert.match(
    checkBalance(Array.from({ length: MIN_TOTAL_QUESTIONS - 1 }, () => ({ polarity: 'positive' }))).reason,
    /at least 10/,
  );
  assert.match(
    checkBalance(Array.from({ length: 10 }, () => ({ polarity: 'positive' }))).reason,
    /negative-habit/,
  );
  assert.match(
    checkBalance(Array.from({ length: 10 }, () => ({ polarity: 'negative' }))).reason,
    /positive-habit/,
  );
  const ok = checkBalance([
    ...Array(7).fill({ polarity: 'positive' }),
    ...Array(3).fill({ polarity: 'negative' }),
  ]);
  assert.equal(ok.ok, true);
  assert.equal(ok.posCount, 7);
  assert.equal(ok.negCount, 3);
});

// ───────────────────────────── parseDraft ─────────────────────────────

test('[CURRENT-BEHAVIOR] parseDraft: valid draft returns answers for the matching owner+date', () => {
  const raw = JSON.stringify({ version: 1, userId: 'A', date: '2026-06-01', answers: { sleep: 3, mood: 1 } });
  assert.deepEqual(parseDraft(raw, 'A', '2026-06-01'), { sleep: 3, mood: 1 });
});

test('[CURRENT-BEHAVIOR] parseDraft: empty/absent raw returns {} without throwing', () => {
  assert.deepEqual(parseDraft(null, 'A', '2026-06-01'), {});
  assert.deepEqual(parseDraft('', 'A', '2026-06-01'), {});
  assert.deepEqual(parseDraft(undefined, 'A', '2026-06-01'), {});
});

test('[CURRENT-BEHAVIOR] parseDraft: rejects wrong owner, wrong date, bad version/shape/values', () => {
  const base = { version: 1, userId: 'A', date: '2026-06-01', answers: { k: 3 } };
  assert.throws(() => parseDraft(JSON.stringify({ ...base, userId: 'B' }), 'A', '2026-06-01'), /Invalid draft/);
  assert.throws(() => parseDraft(JSON.stringify({ ...base, date: '2026-06-02' }), 'A', '2026-06-01'), /Invalid draft/);
  assert.throws(() => parseDraft(JSON.stringify({ ...base, version: 2 }), 'A', '2026-06-01'), /Invalid draft/);
  assert.throws(() => parseDraft(JSON.stringify({ ...base, answers: [1, 2, 3] }), 'A', '2026-06-01'), /Invalid draft/);
  assert.throws(() => parseDraft(JSON.stringify({ ...base, answers: { k: 4 } }), 'A', '2026-06-01'), /Invalid draft/);
  assert.throws(() => parseDraft(JSON.stringify({ ...base, answers: { ['x'.repeat(129)]: 3 } }), 'A', '2026-06-01'), /Invalid draft/);
  assert.throws(() => parseDraft('{not json', 'A', '2026-06-01')); // JSON.parse throws
});

test('[CURRENT-BEHAVIOR] parseDraft: rejects an oversized payload before parsing', () => {
  const huge = '0'.repeat(1000001);
  assert.throws(() => parseDraft(huge, 'A', '2026-06-01'), /Oversized draft/);
});
