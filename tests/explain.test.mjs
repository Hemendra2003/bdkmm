// Tests for src/domain/explain.ts — verified against engine-b-1.json fixture values.
// Node 24 strips types, so we import .ts directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explainResult } from '../src/domain/explain.ts';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/engine-b-1.json', import.meta.url), 'utf8'),
);

// Helper: build minimal ExplainFields from fixture case + expected
function fields(c) {
  const e = c.expected;
  return {
    eligible: e.eligible ?? true,
    status: e.status,
    rawDv: e.rawDv ?? 0,
    mult: e.mult ?? 1,
    rawChange: e.rawChange ?? 0,
    shadow: e.shadow ?? 0,
    intendedChange: e.intendedChange ?? e.rawChange ?? 0,
    actualChange: e.actualChange ?? 0,
    posStreak: e.posStreak ?? 0,
    negStreak: e.negStreak ?? 0,
  };
}

// E1 — first positive scored day
test('E1: eligible scored day produces full breakdown', () => {
  const c = fixture.cases.find((x) => x.id === 'E1');
  const r = explainResult(fields(c));
  assert.equal(r.eligible, true);
  assert.equal(r.status, 'scored');
  assert.ok(r.breakdown, 'breakdown should not be null');
  assert.equal(r.breakdown.raw, '+8');
  assert.equal(r.breakdown.mult, '×1.00');
  assert.equal(r.breakdown.rawChange, '+8');
  assert.equal(r.breakdown.shadow, '0');
  assert.equal(r.breakdown.intendedChange, '+8');
  assert.equal(r.breakdown.actualChange, '+8');
  assert.equal(r.breakdown.floored, false);
  assert.equal(r.engineStreakLine, '1-day positive score streak — multiplier compounding.');
});

// E2 — negative streak amplification
test('E2: eligible scored day with negative streak gives penalty streak line', () => {
  const c = fixture.cases.find((x) => x.id === 'E2');
  const r = explainResult(fields(c));
  assert.equal(r.eligible, true);
  assert.ok(r.breakdown);
  assert.equal(r.breakdown.raw, '-10');
  assert.equal(r.breakdown.mult, '×2.04');
  assert.equal(r.breakdown.rawChange, '-20');
  assert.equal(r.breakdown.shadow, '0');
  assert.equal(r.breakdown.intendedChange, '-20');
  assert.equal(r.breakdown.actualChange, '-20');
  assert.equal(r.breakdown.floored, false);
  assert.equal(r.engineStreakLine, '4-day negative score streak — penalty multiplier active.');
});

// E3 — partial day, not eligible
test('E3: partial day yields null breakdown and pending streak line', () => {
  const c = fixture.cases.find((x) => x.id === 'E3');
  const r = explainResult(fields(c));
  assert.equal(r.eligible, false);
  assert.equal(r.status, 'pending');
  assert.equal(r.breakdown, null);
  assert.equal(r.engineStreakLine, 'Score pending — finish all actions to publish.');
});

// E4 — all excused, no action
test('E4: all-excused day yields null breakdown and no-action streak line', () => {
  const c = fixture.cases.find((x) => x.id === 'E4');
  const r = explainResult(fields(c));
  assert.equal(r.eligible, false);
  assert.equal(r.status, 'no-action');
  assert.equal(r.breakdown, null);
  assert.equal(r.engineStreakLine, 'No action score — all actions excused or none due.');
});

// E7-daily — zero floor applied
test('E7-daily: floored actualChange shows zero floor annotation', () => {
  const c = fixture.cases.find((x) => x.id === 'E7-daily');
  const r = explainResult(fields(c));
  assert.equal(r.eligible, true);
  assert.ok(r.breakdown);
  assert.equal(r.breakdown.mult, '×1.15');
  assert.equal(r.breakdown.rawChange, '-12');
  assert.equal(r.breakdown.shadow, '0');
  assert.equal(r.breakdown.intendedChange, '-12');
  assert.equal(r.breakdown.actualChange, '-5 (zero floor)');
  assert.equal(r.breakdown.floored, true);
  assert.equal(r.engineStreakLine, '1-day negative score streak — penalty multiplier active.');
});

// negative-half-tie
test('negative-half-tie: rawChange -9 formatted correctly', () => {
  const c = fixture.cases.find((x) => x.id === 'negative-half-tie');
  const r = explainResult(fields(c));
  assert.equal(r.eligible, true);
  assert.ok(r.breakdown);
  assert.equal(r.breakdown.rawChange, '-9');
  assert.equal(r.breakdown.mult, '×1.70');
  assert.equal(r.breakdown.floored, false);
  assert.equal(r.engineStreakLine, '3-day negative score streak — penalty multiplier active.');
});

// Draft status
test('draft status: null breakdown and draft streak line', () => {
  const r = explainResult({
    eligible: false,
    status: 'draft',
    rawDv: 0,
    mult: 1,
    rawChange: 0,
    shadow: 0,
    intendedChange: 0,
    actualChange: 0,
    posStreak: 0,
    negStreak: 0,
  });
  assert.equal(r.breakdown, null);
  assert.equal(r.engineStreakLine, 'Draft saved — no score or score streak change yet.');
});

// Streak reset (eligible but actualChange=0, no ongoing streak)
test('eligible day with no streak: streak reset line', () => {
  const r = explainResult({
    eligible: true,
    rawDv: 0,
    mult: 1,
    rawChange: 0,
    shadow: 0,
    intendedChange: 0,
    actualChange: 0,
    posStreak: 0,
    negStreak: 0,
  });
  assert.ok(r.breakdown);
  assert.equal(r.breakdown.raw, '+0');
  assert.equal(r.engineStreakLine, 'Score streak reset. Build from here.');
});

// Shadow non-zero display
test('non-zero shadow shows minus sign', () => {
  const r = explainResult({
    eligible: true,
    rawDv: 8,
    mult: 1,
    rawChange: 8,
    shadow: 2,
    intendedChange: 6,
    actualChange: 6,
    posStreak: 1,
    negStreak: 0,
  });
  assert.ok(r.breakdown);
  assert.equal(r.breakdown.shadow, '−2');
  assert.equal(r.breakdown.intendedChange, '+6');
  assert.equal(r.breakdown.floored, false);
});
