// Two-user Row-Level Security (RLS) isolation test against a STAGING Supabase project.
//
// RLS = the Postgres feature that restricts which rows each signed-in user may
// read/write. This test proves that the policies in
// supabase/migrations/0001_momentum_core.sql actually isolate accounts: user B
// and an anonymous caller must not be able to read or change user A's data, and
// nobody may forge another account's user_id on insert.
//
// SAFETY / SCOPE:
//   * Uses the PUBLISHABLE (anon) key only — never a service-role key. It talks
//     to Supabase exactly as the browser client does, so it exercises real RLS.
//   * SKIPS itself unless STAGING env vars are set, so `npm test` stays offline.
//   * Only ever targets staging. Never point VITE_SUPABASE_URL at production.
//   * Creates throwaway users rls-<rand>@example.test and deletes their rows at
//     the end. It cannot delete the auth users with the publishable key; those
//     empty throwaway accounts remain in staging (harmless).
//
// Run: npm run test:integration   (with staging env loaded)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
// @supabase/supabase-js is imported dynamically only when the suite runs, so the
// default offline `npm test` can skip this file without node_modules installed.
let createClient;

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Gate: without staging credentials, skip so the default offline test run is green.
if (!URL || !KEY) {
  test('RLS isolation against staging', { skip: 'STAGING env not set (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)' }, () => {});
} else if (/ejrlskbemmdxomznmutx/.test(URL)) {
  // Hard stop: the known production project ref must never be the target.
  test('RLS isolation against staging', () => {
    assert.fail('Refusing to run: VITE_SUPABASE_URL points at the production project.');
  });
} else {
  runSuite();
}

function freshClient() {
  // Each client keeps its own auth session (persistSession:false) so A, B and
  // anon never share a token in-process.
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const TEST_DATE = '2026-06-15';
const QUESTION = {
  key: 'rls_test_q',
  text: 'RLS test habit',
  opts: ['Low', 'Mid', 'High'],
  polarity: 'positive',
  tier: 'S',
};

async function signUpUser(client, label) {
  const email = `rls-${randomUUID().slice(0, 8)}@example.test`;
  const password = `Rls!${randomUUID()}`; // > 6 chars, meets the policy
  const { data, error } = await client.auth.signUp({ email, password });
  assert.equal(error, null, `${label} sign-up should succeed (confirm-email must be off): ${error && error.message}`);
  const userId = data && data.user && data.user.id;
  assert.ok(userId, `${label} sign-up should return a user id`);
  assert.ok(data.session, `${label} sign-up should return a session (email confirmation off)`);
  return { email, userId };
}

function runSuite() {
  test('RLS isolation against staging', async (t) => {
    ({ createClient } = await import('@supabase/supabase-js'));
    const clientA = freshClient();
    const clientB = freshClient();
    const clientAnon = freshClient(); // never signed in

    const A = await signUpUser(clientA, 'User A');
    const B = await signUpUser(clientB, 'User B');
    assert.notEqual(A.userId, B.userId, 'A and B must be different accounts');

    // ---- A seeds one row in each table (baseline: A can write its own data) ----
    await t.test('A can insert its own entry, question and settings', async () => {
      const e = await clientA
        .from('momentum_entries')
        .insert({ user_id: A.userId, date: TEST_DATE, answers: { [QUESTION.key]: 3 } })
        .select('date')
        .single();
      assert.equal(e.error, null, `A insert entry: ${e.error && e.error.message}`);

      const q = await clientA
        .from('user_questions')
        .insert({ user_id: A.userId, ...QUESTION })
        .select('key')
        .single();
      assert.equal(q.error, null, `A insert question: ${q.error && q.error.message}`);

      const s = await clientA
        .from('user_settings')
        .insert({ user_id: A.userId, legacy_migrated: true })
        .select('user_id')
        .single();
      assert.equal(s.error, null, `A insert settings: ${s.error && s.error.message}`);
    });

    // ---- B must not be able to READ A's rows ----
    await t.test('B cannot SELECT A\'s rows (all three tables return nothing)', async () => {
      for (const table of ['momentum_entries', 'user_questions', 'user_settings']) {
        const { data, error } = await clientB.from(table).select('*').eq('user_id', A.userId);
        // RLS filters rows out: expect success with an empty set (or a permission error).
        if (error) continue; // a hard denial is also acceptable
        assert.deepEqual(data, [], `B should see no ${table} rows of A, saw ${data && data.length}`);
      }
    });

    // ---- B must not be able to UPDATE A's rows ----
    await t.test('B cannot UPDATE A\'s entry (0 rows changed, A\'s data intact)', async () => {
      const upd = await clientB
        .from('momentum_entries')
        .update({ answers: { hacked: 1 } })
        .eq('user_id', A.userId)
        .eq('date', TEST_DATE)
        .select('date');
      // Either a denial error, or success affecting zero rows.
      if (!upd.error) assert.deepEqual(upd.data, [], 'B\'s update should touch 0 of A\'s rows');
      // Confirm as A that the value is unchanged.
      const check = await clientA
        .from('momentum_entries')
        .select('answers')
        .eq('user_id', A.userId)
        .eq('date', TEST_DATE)
        .single();
      assert.equal(check.error, null, `A re-read: ${check.error && check.error.message}`);
      assert.deepEqual(check.data.answers, { [QUESTION.key]: 3 }, 'A\'s answers must be unchanged');
    });

    // ---- B must not be able to DELETE A's rows ----
    await t.test('B cannot DELETE A\'s rows (A\'s entry still present)', async () => {
      const del = await clientB
        .from('momentum_entries')
        .delete()
        .eq('user_id', A.userId)
        .eq('date', TEST_DATE)
        .select('date');
      if (!del.error) assert.deepEqual(del.data, [], 'B\'s delete should remove 0 of A\'s rows');
      const check = await clientA
        .from('momentum_entries')
        .select('date')
        .eq('user_id', A.userId)
        .eq('date', TEST_DATE)
        .maybeSingle();
      assert.equal(check.error, null, `A re-read: ${check.error && check.error.message}`);
      assert.ok(check.data, 'A\'s entry must still exist after B\'s delete attempt');
    });

    // ---- B must not be able to INSERT a row owned by A (forged user_id) ----
    await t.test('B cannot INSERT a row with A\'s user_id (WITH CHECK blocks forgery)', async () => {
      const ins = await clientB
        .from('momentum_entries')
        .insert({ user_id: A.userId, date: '2026-06-16', answers: { forged: 1 } })
        .select('date');
      assert.ok(ins.error, 'B inserting a row owned by A must be rejected by RLS WITH CHECK');
      // And verify no such row exists under A.
      const check = await clientA
        .from('momentum_entries')
        .select('date')
        .eq('user_id', A.userId)
        .eq('date', '2026-06-16');
      assert.equal(check.error, null, `A re-read: ${check.error && check.error.message}`);
      assert.deepEqual(check.data, [], 'No forged row should exist under A');
    });

    // ---- A must not be able to INSERT a row owned by B ----
    await t.test('A cannot INSERT a row with B\'s user_id', async () => {
      const ins = await clientA
        .from('user_questions')
        .insert({ user_id: B.userId, key: 'forged_by_a', ...QUESTION })
        .select('key');
      assert.ok(ins.error, 'A inserting a row owned by B must be rejected by RLS WITH CHECK');
    });

    // ---- Anonymous caller must not read or write anything ----
    await t.test('anon cannot SELECT any rows', async () => {
      for (const table of ['momentum_entries', 'user_questions', 'user_settings']) {
        const { data, error } = await clientAnon.from(table).select('*');
        if (error) continue; // permission denied is acceptable (grants revoked from anon)
        assert.deepEqual(data, [], `anon should read no ${table} rows, saw ${data && data.length}`);
      }
    });

    await t.test('anon cannot INSERT', async () => {
      const ins = await clientAnon
        .from('momentum_entries')
        .insert({ user_id: A.userId, date: '2026-06-17', answers: { anon: 1 } })
        .select('date');
      assert.ok(ins.error, 'anon insert must be rejected');
    });

    // ---- Cleanup: each user removes its own rows (RLS lets them delete only their own) ----
    await t.test('cleanup: A and B delete their own rows', async () => {
      for (const table of ['momentum_entries', 'user_questions', 'user_settings']) {
        const a = await clientA.from(table).delete().eq('user_id', A.userId);
        assert.equal(a.error, null, `A cleanup ${table}: ${a.error && a.error.message}`);
        const b = await clientB.from(table).delete().eq('user_id', B.userId);
        assert.equal(b.error, null, `B cleanup ${table}: ${b.error && b.error.message}`);
      }
      await clientA.auth.signOut();
      await clientB.auth.signOut();
    });
  });
}
