// Injected Supabase client double; exercises the actual typed repository bundle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { buildDataBundle, bundledStorage } from '../src/data/build-legacy.mjs';
const storageSource = readFileSync(new URL('../storage.js', import.meta.url), 'utf8');
const api = vm.runInNewContext(buildDataBundle() + '\nMomentumRepositories;', { Date });
const stamp = '2026-09-05T12:00:00.000Z';
const entry = { date: '2026-09-05', answers: { habit: 3 }, updated_at: stamp };
const question = {
  id: 'question-1',
  key: 'habit',
  text: 'Habit',
  opts: ['Low', 'Mid', 'High'],
  polarity: 'positive',
  tier: 'A',
  is_fixed: false,
  source: 'custom',
  sort_order: 0,
};
const settings = { legacy_migrated: false, migrated_at: null };
const plain = (value) => JSON.parse(JSON.stringify(value));
function fakeClient() {
  const calls = [];
  let response = null;
  const client = {
    calls,
    setResponse(value) {
      response = value;
    },
    from(table) {
      const call = { table, filters: [], op: 'read', columns: null, payload: null };
      calls.push(call);
      const query = {
        select(columns) {
          call.columns = columns;
          return this;
        },
        eq(column, value) {
          call.filters.push([column, value]);
          return this;
        },
        neq(column, value) {
          call.filters.push([column + '!=', value]);
          return this;
        },
        order(column, options) {
          call.order = [column, options];
          return this;
        },
        upsert(payload, options) {
          call.op = 'upsert';
          call.payload = payload;
          call.options = options;
          return this;
        },
        delete() {
          call.op = 'delete';
          return this;
        },
        single() {
          call.single = true;
          return this;
        },
        maybeSingle() {
          call.maybe = true;
          return this;
        },
        async then(resolve, reject) {
          try {
            if (response)
              return resolve(typeof response === 'function' ? await response(call) : response);
            if (call.op === 'delete' || !call.columns) return resolve({ data: null, error: null });
            let data;
            if (table === 'momentum_entries') {
              data =
                call.op === 'upsert'
                  ? Array.isArray(call.payload)
                    ? call.payload.map((row) => ({ ...row, updated_at: stamp }))
                    : { ...call.payload, updated_at: stamp }
                  : [entry];
            } else if (table === 'user_questions') {
              data =
                call.op === 'upsert'
                  ? Array.isArray(call.payload)
                    ? call.payload.map((row) => ({ ...row, id: question.id }))
                    : { ...call.payload, id: question.id }
                  : [question];
            } else {
              data = settings;
            }
            if (call.single || call.maybe) data = Array.isArray(data) ? (data[0] ?? null) : data;
            return resolve({ data, error: null });
          } catch (error) {
            return reject(error);
          }
        },
      };
      return query;
    },
  };
  return client;
}
function harness() {
  let user = 'A';
  const client = fakeClient();
  const warnings = [];
  const repos = api.createRepositories({
    client,
    getUserId: () => user,
    now: () => new Date(stamp),
    warn: (issue) => warnings.push(issue),
  });
  return {
    client,
    repos,
    warnings,
    setUser: (value) => {
      user = value;
    },
  };
}
const operations = (repos) => [
  () => repos.entries.list(),
  () => repos.entries.get(entry.date),
  () => repos.entries.save(entry.date, entry.answers),
  () => repos.entries.removeAll(),
  () => repos.entries.import([{ date: entry.date, answers: entry.answers }]),
  () => repos.questions.list(),
  () => repos.questions.save(question),
  () => repos.questions.saveMany([question]),
  () => repos.questions.remove(question.key),
  () => repos.settings.get(),
  () => repos.settings.markMigrated(),
];

test('classic data bundle stays fresh, executes in storage bridge and leaves native Storage intact', async () => {
  assert.equal(storageSource, bundledStorage(storageSource));
  const nativeStorage = function NativeStorage() {};
  const client = fakeClient();
  const context = {
    window: { Storage: nativeStorage, supabaseClient: client, Auth: { getUserId: () => 'A' } },
    Date,
  };
  vm.runInNewContext(storageSource, context);
  assert.equal(context.window.Storage, nativeStorage);
  assert.equal((await context.window.MomentumData.loadEntry(entry.date)).date, entry.date);
  assert.equal(typeof context.window.MomentumData.saveQuestion, 'function');
});

test('every read and mutation includes the current user_id query filter and owned upsert payload', async () => {
  const h = harness();
  for (const call of operations(h.repos)) await call();
  assert.equal(h.client.calls.length, 11);
  for (const query of h.client.calls) {
    assert(query.filters.some(([field, value]) => field === 'user_id' && value === 'A'));
    if (query.payload) {
      const rows = Array.isArray(query.payload) ? query.payload : [query.payload];
      rows.forEach((row) => assert.equal(row.user_id, 'A'));
    }
  }
  h.setUser('B');
  await h.repos.entries.list();
  assert(
    h.client.calls.at(-1).filters.some(([field, value]) => field === 'user_id' && value === 'B'),
  );
});

test('table projections, conflict keys and payload columns retain existing schema contracts', async () => {
  const h = harness();
  await h.repos.entries.save(entry.date, { habit: 3 });
  await h.repos.questions.save(question);
  await h.repos.settings.markMigrated();
  const [e, q, s] = h.client.calls;
  assert.equal(e.table, 'momentum_entries');
  assert.equal(e.columns, 'date,answers,updated_at');
  assert.equal(e.options.onConflict, 'user_id,date');
  assert.deepEqual(Object.keys(e.payload).sort(), ['answers', 'date', 'user_id']);
  assert.equal(q.table, 'user_questions');
  assert.equal(q.columns, 'id,key,text,opts,polarity,tier,is_fixed,source,sort_order');
  assert.equal(q.options.onConflict, 'user_id,key');
  assert.deepEqual(Object.keys(q.payload).sort(), [
    'is_fixed',
    'key',
    'opts',
    'polarity',
    'sort_order',
    'source',
    'text',
    'tier',
    'user_id',
  ]);
  assert.equal(s.table, 'user_settings');
  assert.equal(s.options.onConflict, 'user_id');
  assert.deepEqual(plain(s.payload), { user_id: 'A', legacy_migrated: true, migrated_at: stamp });
});

test('all operations refuse missing/non-string user before querying', async () => {
  for (const user of [null, undefined, '', 42, {}]) {
    const h = harness();
    h.setUser(user);
    for (const call of operations(h.repos)) await assert.rejects(call, /signed-in user/);
    assert.equal(h.client.calls.length, 0);
  }
});

test('single-day reads tolerate corrupt fields/rows but reject protocol, date and ownership failures', async () => {
  const h = harness();
  h.client.setResponse({ data: null, error: null });
  assert.equal(await h.repos.entries.get(entry.date), null);
  for (const data of [
    undefined,
    { ...entry, date: '2026-09-04' },
    { ...entry, user_id: 'B', answers: 'bad' },
  ]) {
    h.client.setResponse({ data, error: null });
    await assert.rejects(h.repos.entries.get(entry.date));
  }
  for (const data of [{}, [], { ...entry, answers: 'bad' }]) {
    h.client.setResponse({ data, error: null });
    assert.equal(await h.repos.entries.get(entry.date), null);
  }
  h.client.setResponse({
    data: { ...entry, answers: { habit: ' 3 ', bad: 99 }, updated_at: 'bad' },
    error: null,
  });
  assert.deepEqual(plain(await h.repos.entries.get(entry.date)), {
    ...entry,
    answers: { habit: 3 },
    updated_at: null,
  });
  assert(
    h.client.calls[0].filters.some(([field, value]) => field === 'date' && value === entry.date),
  );
});

test('legacy numeric answers normalize on reads, invalid fields drop and good rows survive corruption', async () => {
  const h = harness();
  const legacy = {
    ...entry,
    answers: {
      a: '1',
      b: ' 2 ',
      c: '3.0',
      d: null,
      bad: '3x',
      blank: ' ',
      nope: 4,
      ...JSON.parse('{"__proto__":3}'),
    },
  };
  h.client.setResponse({
    data: [legacy, { ...entry, date: '2026-02-30' }, null, { ...entry, date: '2026-09-06' }],
    error: null,
  });
  const rows = await h.repos.entries.list();
  assert.deepEqual(plain(rows[0].answers), { a: 1, b: 2, c: 3, d: null });
  assert.equal(rows.length, 2);
  assert.equal(rows[1].date, '2026-09-06');
  assert.deepEqual(plain(h.repos.getReadDiagnostics()), {
    normalizedFields: 3,
    droppedFields: 4,
    droppedRows: 2,
  });
  assert.equal(h.warnings.length, 9);
  for (const warning of h.warnings) {
    assert.deepEqual(Object.keys(warning).sort(), ['action', 'field', 'identifier', 'table']);
    assert.equal(warning.table, 'entries');
  }
  h.client.setResponse({ data: [{ ...entry, user_id: 'B', date: 'bad' }], error: null });
  await assert.rejects(h.repos.entries.list(), /different account/);
  h.client.setResponse({ data: {}, error: null });
  await assert.rejects(h.repos.entries.list(), /list of rows/);
});

test('entry writes reject invalid date/answer shape before mutation and preserve partial/null answers', async () => {
  const h = harness();
  for (const date of ['2026-02-30', '0000-00-00', 'not-a-date', 42])
    await assert.rejects(h.repos.entries.save(date, entry.answers));
  for (const values of [
    null,
    [],
    { habit: '3' },
    { habit: 0 },
    { habit: Infinity },
    JSON.parse('{"__proto__":3}'),
  ])
    await assert.rejects(h.repos.entries.save(entry.date, values));
  assert.equal(h.client.calls.length, 0);
  const result = await h.repos.entries.save('2024-02-29', { habit: null });
  assert.equal(result.date, '2024-02-29');
  assert.equal(result.answers.habit, null);
});

test('question reads drop corrupt rows while preserving good questions and bounded legacy text', async () => {
  const h = harness();
  for (const bad of [
    { ...question, id: null },
    { ...question, tier: 'C' },
    { ...question, polarity: 'unknown' },
    { ...question, opts: ['a', 'b'] },
    { ...question, opts: ['a', 3, 'c'] },
    { ...question, is_fixed: 'true' },
    { ...question, source: 'unknown' },
    { ...question, sort_order: 1.5 },
  ]) {
    h.client.setResponse({ data: [question, bad], error: null });
    assert.deepEqual(plain(await h.repos.questions.list()), [question]);
  }
  h.client.setResponse({ data: [{ ...question, text: 'x'.repeat(81) }], error: null });
  assert.equal((await h.repos.questions.list())[0].text.length, 81);
  h.client.setResponse({ data: [{ ...question, user_id: 'B', tier: 'C' }], error: null });
  await assert.rejects(h.repos.questions.list(), /different account/);
});

test('question writes validate runtime input, defaults and text without HTML encoding', async () => {
  const h = harness();
  for (const bad of [
    null,
    { ...question, text: 'x'.repeat(81) },
    { ...question, opts: ['a', ' ', 'c'] },
    { ...question, opts: ['a', 'b', 'x'.repeat(81)] },
    { ...question, key: 'constructor' },
    { ...question, tier: 'C' },
    { ...question, user_id: 'B' },
  ])
    await assert.rejects(h.repos.questions.save(bad));
  assert.equal(h.client.calls.length, 0);
  const result = await h.repos.questions.save({
    key: 'custom',
    text: '<b>Habit</b>',
    opts: ['<5k steps', 'Mid', 'High'],
    polarity: 'positive',
    tier: 'A',
  });
  assert.equal(result.text, '<b>Habit</b>');
  assert.equal(result.opts[0], '<5k steps');
  assert.equal(result.source, 'custom');
  assert.equal(result.is_fixed, false);
  assert.equal(result.sort_order, 0);
});

test('batch validates every member and duplicates before any query; forged owners rejected', async () => {
  const h = harness();
  await assert.rejects(h.repos.entries.import([entry, { ...entry, date: 'bad' }]));
  await assert.rejects(h.repos.entries.import([{ ...entry, user_id: 'B' }]));
  await assert.rejects(h.repos.entries.import([entry, entry]), /Duplicate/);
  await assert.rejects(
    h.repos.questions.saveMany([question, { ...question, key: 'other', tier: 'C' }]),
  );
  await assert.rejects(h.repos.questions.saveMany([question, question]), /Duplicate/);
  assert.equal(h.client.calls.length, 0);
  assert.deepEqual(plain(await h.repos.entries.import([])), []);
  assert.deepEqual(plain(await h.repos.questions.saveMany([])), []);
  assert.equal(h.client.calls.length, 0);
});

test('malformed or incomplete mutation responses are rejected', async () => {
  const h = harness();
  h.client.setResponse({ data: { ...entry, date: '2026-09-04' }, error: null });
  await assert.rejects(h.repos.entries.save(entry.date, entry.answers));
  h.client.setResponse({ data: { ...question, key: 'other' }, error: null });
  await assert.rejects(h.repos.questions.save(question));
  h.client.setResponse({ data: [], error: null });
  await assert.rejects(h.repos.questions.saveMany([question]), /Incomplete/);
  await assert.rejects(h.repos.entries.import([entry]), /Incomplete/);
});

test('settings tolerate corrupt fields without triggering another legacy migration; ownership stays strict', async () => {
  const h = harness();
  h.client.setResponse({ data: null, error: null });
  assert.deepEqual(plain(await h.repos.settings.get()), settings);
  h.client.setResponse({ data: undefined, error: null });
  await assert.rejects(h.repos.settings.get(), /Missing settings/);
  for (const data of [
    {},
    { legacy_migrated: 'true', migrated_at: null },
    { legacy_migrated: true, migrated_at: 'bad' },
    [],
  ]) {
    h.client.setResponse({ data, error: null });
    assert.deepEqual(plain(await h.repos.settings.get()), {
      legacy_migrated: true,
      migrated_at: null,
    });
  }
  h.client.setResponse({ data: { ...settings, user_id: 'B' }, error: null });
  await assert.rejects(h.repos.settings.get(), /different account/);
});

test('diagnostics are snapshots scoped to the current account and warnings never log content', async () => {
  const h = harness();
  const privateText = 'private label and answer content';
  h.client.setResponse({
    data: [
      { ...entry, answers: { habit: privateText } },
      { ...question, key: privateText },
    ],
    error: null,
  });
  await h.repos.entries.list();
  assert(!JSON.stringify(h.warnings).includes(privateText));
  const counts = h.repos.getReadDiagnostics();
  counts.droppedRows = 999;
  assert.equal(h.repos.getReadDiagnostics().droppedRows, 1);
  h.setUser('B');
  assert.deepEqual(plain(h.repos.getReadDiagnostics()), {
    normalizedFields: 0,
    droppedFields: 0,
    droppedRows: 0,
  });
  h.setUser(null);
  assert.throws(() => h.repos.getReadDiagnostics(), /signed-in user/);
});

test('delete filters include owner plus target and malformed delete key never queries', async () => {
  const h = harness();
  await assert.rejects(h.repos.questions.remove(''));
  assert.equal(h.client.calls.length, 0);
  await h.repos.questions.remove(question.key);
  assert.deepEqual(h.client.calls[0].filters, [
    ['user_id', 'A'],
    ['key', question.key],
  ]);
  await h.repos.entries.removeAll();
  assert.deepEqual(h.client.calls[1].filters, [
    ['user_id', 'A'],
    ['date!=', '0000-00-00'],
  ]);
});

test('query errors propagate for every operation without a success/empty fallback', async () => {
  const h = harness(),
    error = new Error('test backend unavailable');
  h.client.setResponse({ data: null, error });
  for (const call of operations(h.repos)) await assert.rejects(call, (caught) => caught === error);
});

test('account changes reject late read/write results instead of returning stale account data', async () => {
  for (const operation of [
    (repos) => repos.entries.list(),
    (repos) => repos.entries.save(entry.date, entry.answers),
  ]) {
    const h = harness();
    h.client.setResponse(() => {
      h.setUser('B');
      return { data: [entry], error: null };
    });
    await assert.rejects(operation(h.repos), /Account changed/);
    assert(
      h.client.calls[0].filters.some(([field, value]) => field === 'user_id' && value === 'A'),
    );
  }
});

test('explicit boundary reset clears diagnostics across same-owner logout/login', async () => {
  const h = harness();
  h.client.setResponse({ data: [{ ...entry, answers: { habit: '3' } }], error: null });
  await h.repos.entries.list();
  assert.equal(h.repos.getReadDiagnostics().normalizedFields, 1);
  h.setUser(null);
  h.repos.resetReadDiagnostics();
  h.setUser('A');
  assert.deepEqual(plain(h.repos.getReadDiagnostics()), {
    normalizedFields: 0,
    droppedFields: 0,
    droppedRows: 0,
  });
});
