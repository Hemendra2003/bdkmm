// Characterization (golden) tests for the CURRENT scoring engine.
//
// PURPOSE: freeze today's behavior of scoreForAnswer / runEngine / recomputeAll
// in app.js BEFORE any refactor, so later rule changes are deliberate, not
// accidental. These are NOT acceptance tests — several cases lock in behavior
// the engineering audit flagged as bugs. Each test is labelled:
//   [CURRENT-BEHAVIOR] — intended / benign behavior worth preserving.
//   [KNOWN-BUG: AUDIT-NN] — a defect from audit/AUDIT.md; the assertion captures
//                           the WRONG output on purpose. When the bug is fixed,
//                           this test SHOULD fail — update it then, deliberately.
//
// Loads functions from app.js WITHOUT editing it: the engine slice (from the
// "// STORAGE ADAPTERS" marker to the final IIFE) is extracted by source text
// and run in a vm context with minimal window/document stubs (same technique as
// audit/reproduce.mjs). Zero dependencies. Run: node --test tests/
//
// If app.js is restructured so the markers or function names below move/vanish,
// loadEngine() throws with a clear message — that is the signal to review, not
// to silently weaken the tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app.js');

// Build a fresh, isolated engine harness per test so no case leaks state.
function loadEngine() {
  const source = fs.readFileSync(APP_JS, 'utf8');
  const start = source.indexOf('// STORAGE ADAPTERS');
  const end = source.lastIndexOf('(async()=>{');
  assert.ok(start > 0 && end > start, 'app.js markers moved; review test extraction.');

  const elements = new Map();
  const element = () => {
    const classes = new Set();
    return {
      style: {},
      children: [],
      innerHTML: '',
      textContent: '',
      dataset: {},
      scrollIntoView() {},
      classList: {
        add: (x) => classes.add(x),
        remove: (x) => classes.delete(x),
        contains: (x) => classes.has(x),
      },
      appendChild(child) {
        this.children.push(child);
      },
    };
  };
  const ctx = vm.createContext({
    window: {},
    console,
    Date,
    Math,
    JSON,
    parseInt,
    parseFloat,
    setTimeout,
    clearTimeout,
    alert() {},
    confirm: () => true,
    document: {
      addEventListener() {},
      createElement: element,
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
    },
  });
  vm.runInContext(source.slice(start, end), ctx);

  // Sanity: the three functions under test must exist as functions.
  for (const fn of ['scoreForAnswer', 'runEngine', 'recomputeAll']) {
    assert.equal(
      vm.runInContext(`typeof ${fn}`, ctx),
      'function',
      `${fn} not found in app.js slice`,
    );
  }

  return {
    run: (code) => vm.runInContext(code, ctx),
    setQuestions(qs) {
      ctx.window.UserQuestions = qs;
    },
  };
}

// Question helpers (shape matches app.js: {key,text,opts,polarity,tier}).
const pos = (key, tier = 'S') => ({
  key,
  text: key,
  opts: ['Bad', 'Okay', 'Good'],
  polarity: 'positive',
  tier,
});
const neg = (key, tier = 'S') => ({
  key,
  text: key,
  opts: ['Bad', 'Okay', 'Good'],
  polarity: 'negative',
  tier,
});

// ───────────────────────────────────────────────────────────────────────────
// scoreForAnswer(question, strengthIndex)
// strengthIndex 0/1/2 -> bad/neutral/good. Pure lookup into TIER_WEIGHTS.
// ───────────────────────────────────────────────────────────────────────────

test('[CURRENT-BEHAVIOR] scoreForAnswer: positive tier weights (S/A/B, bad..good)', () => {
  const { run } = loadEngine();
  assert.equal(run('scoreForAnswer({polarity:"positive",tier:"S"},0)'), -5);
  assert.equal(run('scoreForAnswer({polarity:"positive",tier:"S"},1)'), 0);
  assert.equal(run('scoreForAnswer({polarity:"positive",tier:"S"},2)'), 8);
  assert.equal(run('scoreForAnswer({polarity:"positive",tier:"A"},2)'), 5);
  assert.equal(run('scoreForAnswer({polarity:"positive",tier:"B"},2)'), 3);
});

test('[CURRENT-BEHAVIOR] scoreForAnswer: negative tier weights (bad hurts, good is neutral 0)', () => {
  const { run } = loadEngine();
  assert.equal(run('scoreForAnswer({polarity:"negative",tier:"S"},0)'), -10);
  assert.equal(run('scoreForAnswer({polarity:"negative",tier:"S"},1)'), -4);
  assert.equal(run('scoreForAnswer({polarity:"negative",tier:"S"},2)'), 0);
  assert.equal(run('scoreForAnswer({polarity:"negative",tier:"B"},0)'), -3);
});

test('[CURRENT-BEHAVIOR] scoreForAnswer: strengthIndex is clamped to 0..2', () => {
  const { run } = loadEngine();
  assert.equal(run('scoreForAnswer({polarity:"positive",tier:"A"},5)'), 5); // ->good
  assert.equal(run('scoreForAnswer({polarity:"positive",tier:"A"},-3)'), -3); // ->bad
});

test('[CURRENT-BEHAVIOR] scoreForAnswer: unknown polarity falls back to positive table, unknown tier to B', () => {
  const { run } = loadEngine();
  assert.equal(run('scoreForAnswer({polarity:"zzz",tier:"S"},2)'), 8); // positive-S good
  assert.equal(run('scoreForAnswer({polarity:"positive",tier:"Z"},2)'), 3); // B good
});

// ───────────────────────────────────────────────────────────────────────────
// runEngine(answers, prevV, posS, negS)
// Iterates getActiveQuestions() (window.UserQuestions); answer values are
// 1-based strings/numbers mapped to idx = (parseInt||1)-1.
// ───────────────────────────────────────────────────────────────────────────

test('[CURRENT-BEHAVIOR] runEngine: one S-positive "good" day from velocity 100', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  const r = e.run('runEngine({sleep:3},100,0,0)');
  assert.deepEqual(
    {
      thrust: r.thrust,
      drag: r.drag,
      rawDv: r.rawDv,
      mult: r.mult,
      finalDv: r.finalDv,
      newVelocity: r.newVelocity,
      posStreak: r.posStreak,
      negStreak: r.negStreak,
    },
    {
      thrust: 8,
      drag: 0,
      rawDv: 8,
      mult: 1,
      finalDv: 8,
      newVelocity: 108,
      posStreak: 1,
      negStreak: 0,
    },
  );
});

test('[CURRENT-BEHAVIOR] runEngine: null/undefined answers are skipped (no score, no throw)', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  assert.equal(e.run('runEngine({sleep:null},100,0,0).thrust'), 0);
  assert.equal(e.run('runEngine({},100,0,0).rawDv'), 0);
});

test('[CURRENT-BEHAVIOR] runEngine: negative-streak multiplier amplifies a bad day', () => {
  const e = loadEngine();
  e.setQuestions([neg('vice')]);
  // args: (answers, prevV=100, posS=0, negS=3). Negative-side mult = 1+pow(negS+1,1.4)*0.15.
  const r = e.run('runEngine({vice:1},100,0,3)');
  assert.deepEqual(
    {
      rawDv: r.rawDv,
      mult: r.mult,
      finalDv: r.finalDv,
      newVelocity: r.newVelocity,
      negStreak: r.negStreak,
    },
    { rawDv: -10, mult: 2.04, finalDv: -20, newVelocity: 80, negStreak: 4 },
  );
});

test('[FIXED-IN-B-1: AUDIT-11] runEngine: non-numeric answer is rejected rather than scored', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  // parseInt("garbage") -> NaN -> ||1 -> 1 -> idx 0 ("bad"). S-positive bad = -5 -> drag 5.
  assert.equal(e.run('runEngine({sleep:"garbage"},100,0,0).drag'), 0); // Legacy: 5.
});

test('[FIXED-IN-B-1: AUDIT-11] runEngine: answer "0" is rejected rather than scored', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  // "0" -> parseInt 0 -> 0||1 -> 1 -> idx 0 ("bad") rather than an invalid/unanswered state.
  assert.equal(e.run('runEngine({sleep:"0"},100,0,0).drag'), 0); // Legacy: 5.
});

test('[FIXED-IN-B-1: AUDIT-11] runEngine: out-of-range answer is rejected rather than clamped', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  // 999 -> idx 998 -> clamped to 2 ("good") instead of being flagged invalid.
  assert.equal(e.run('runEngine({sleep:999},100,0,0).thrust'), 0); // Legacy: 8.
});

// ───────────────────────────────────────────────────────────────────────────
// recomputeAll(rows)
// Replays rows sorted by date from velocity 100, applies shadow-drag from the
// two most-recent cached entries, marks partial = answeredCount < #questions.
// ───────────────────────────────────────────────────────────────────────────

test('[CURRENT-BEHAVIOR] recomputeAll: first day starts from velocity 100, no shadow', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  const c = e.run("recomputeAll([{date:'2026-06-01',answers:{sleep:3}}])['2026-06-01']");
  assert.deepEqual(
    {
      nv: c.computed.newVelocity,
      shadow: c.computed.shadow,
      finalDv: c.computed.finalDv,
      posStreak: c.computed.posStreak,
      partial: c.partial,
      answeredCount: c.answeredCount,
    },
    { nv: 108, shadow: 0, finalDv: 8, posStreak: 1, partial: false, answeredCount: 1 },
  );
});

test('[CURRENT-BEHAVIOR] recomputeAll: a genuinely incomplete day is marked partial', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep'), pos('mood')]);
  const c = e.run("recomputeAll([{date:'2026-06-01',answers:{sleep:3}}])['2026-06-01']");
  assert.equal(c.partial, true);
  assert.equal(c.answeredCount, 1);
});

test('[CURRENT-BEHAVIOR] recomputeAll: velocity is floored at 0 after a long bad run', () => {
  const e = loadEngine();
  e.setQuestions([neg('vice')]);
  const rows = ['01', '02', '03', '04', '05', '06', '07']
    .map((d) => `{date:'2026-06-${d}',answers:{vice:1}}`)
    .join(',');
  assert.equal(e.run(`recomputeAll([${rows}])['2026-06-07'].computed.newVelocity`), 0);
});

test('[CURRENT-BEHAVIOR] recomputeAll: shadow drag accrues from the two most-recent entries', () => {
  const e = loadEngine();
  e.setQuestions([neg('vice')]);
  // Day1 bad, Day2 bad, Day3 good: day3 still carries shadow from days 1-2.
  const cache = e.run(
    "recomputeAll([{date:'2026-06-01',answers:{vice:1}},{date:'2026-06-02',answers:{vice:1}},{date:'2026-06-03',answers:{vice:3}}])",
  );
  assert.equal(cache['2026-06-02'].computed.shadow, 3); // 0.6*drag(day1=10)*0.5
  assert.equal(cache['2026-06-03'].computed.shadow, 4); // 0.5*(0.6*10 + 0.24*10)
  assert.equal(cache['2026-06-03'].computed.drag, 0); // the day itself is clean
});

test('[FIXED-IN-B-1: AUDIT-10] recomputeAll: a month-long gap resets multiplier continuity', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  // No calendar-gap check: consecutive CACHE entries count as a streak regardless of date distance.
  assert.equal(
    e.run(
      "recomputeAll([{date:'2026-05-01',answers:{sleep:3}},{date:'2026-06-01',answers:{sleep:3}}])['2026-06-01'].computed.posStreak",
    ),
    1, // Legacy: 2; ENGINE.md §4 Variant1 resets closed gaps.
  );
});

test('[FIXED-IN-B-1: AUDIT-10] recomputeAll: calendar shadow ages out across a month gap', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  // Old drag is not aged out by elapsed calendar time.
  assert.equal(
    e.run(
      "recomputeAll([{date:'2026-05-01',answers:{sleep:1}},{date:'2026-06-01',answers:{sleep:3}}])['2026-06-01'].computed.shadow",
    ),
    0, // Legacy: 2 (most-recent row shadow).
  );
});

test('[FIXED-IN-B-1: AUDIT-11] recomputeAll: a null answer leaves completion pending', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep')]);
  const c = e.run("recomputeAll([{date:'2026-06-01',answers:{sleep:null}}])['2026-06-01']");
  assert.equal(c.partial, true); // Legacy: false (null counted as answered).
  assert.equal(c.computed.thrust, 0); // ...yet runEngine skips it, so it adds no score
});

test('[FIXED-IN-B-1: AUDIT-11] recomputeAll: an orphan key cannot inflate the completion count', () => {
  const e = loadEngine();
  e.setQuestions([pos('sleep'), pos('mood')]);
  // Only 1 of 2 active questions answered, but a stale "removed_habit" key makes
  // answeredCount=2, so the half-finished day is wrongly treated as complete.
  const c = e.run(
    "recomputeAll([{date:'2026-06-01',answers:{sleep:3,removed_habit:3}}])['2026-06-01']",
  );
  assert.equal(c.answeredCount, 1); // Legacy: 2 (orphan counted).
  assert.equal(c.partial, true); // Legacy: false (orphan completed day).
});

test('[FIXED-IN-B-1: AUDIT-05] recomputeAll: stored revision survives retiering', () => {
  // Legacy: 103 after S→B. ENGINE §7 E6 requires stored S definition to retain 108.
  const rows = JSON.stringify([
    {
      date: '2026-06-01',
      answers: { sleep: 3 },
      question_set_revision: [pos('sleep', 'S')],
      engine_version: 'b-1',
    },
  ]);
  const sTier = loadEngine();
  sTier.setQuestions([pos('sleep', 'S')]);
  assert.equal(sTier.run(`recomputeAll(${rows})['2026-06-01'].computed.newVelocity`), 108);
  const bTier = loadEngine();
  bTier.setQuestions([pos('sleep', 'B')]);
  assert.equal(bTier.run(`recomputeAll(${rows})['2026-06-01'].computed.newVelocity`), 108);
});
