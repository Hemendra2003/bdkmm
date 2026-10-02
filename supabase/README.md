# Supabase schema (MOMENTUM)

This folder holds the database schema and Row-Level Security (RLS) policies as checked-in SQL, so a project can be provisioned reproducibly and diffed against what is live. RLS = the Postgres feature that restricts which rows each signed-in user can read/write.

- `migrations/0001_momentum_core.sql` — creates `momentum_entries`, `user_questions`, `user_settings` with per-operation RLS and anon lockout, matching how `src/data/repositories.ts` uses them.

> **Never commit secrets.** The staging URL and publishable key live in `hive/research/bdkmm/staging.env` (outside the repo). Do not paste keys into any file here.

## 1. Apply the migration (staging first)

1. Open the Supabase dashboard for the **staging** project → **SQL Editor** → **New query**.
2. Paste the entire contents of `migrations/0001_momentum_core.sql` and click **Run**.
   - It runs in a single transaction and is idempotent for structure/policies (`create table if not exists`, `drop policy if exists` + `create policy`, `create or replace function`/`trigger`), so re-running it is safe.
3. Confirm success, then run the **verification query** in §3 against staging — you should see all three tables with `rls_enabled = true` and four policies each.
4. Do **not** apply this to production. Production already has data and an unknown schema; see §2.

## 2. Inspect production BEFORE touching it

Production's real schema/policies are not in the repo. Run the read-only query in §3 **on the production project** and share the output so we can diff it against `0001_momentum_core.sql`. The query only reads catalog views — it creates, alters, and deletes nothing.

Decide from the diff whether production needs an **additive** migration (new policies/constraints) rather than this fresh-create file; never apply a fresh-create migration blindly to a populated database (Master Plan 1 §2.2).

## 3. Read-only verification / production-diff query

Paste this whole block into the SQL Editor and run. It lists, for the three MOMENTUM tables: columns + types, whether RLS is enabled and forced, and every policy with its command and USING/WITH CHECK expressions.

```sql
-- READ-ONLY. Lists columns, RLS status, and policies for the MOMENTUM tables.
-- Safe to run on production: it only reads system catalogs.
with t(name) as (
  values ('momentum_entries'), ('user_questions'), ('user_settings')
)
-- 3a. Columns and types
select 'column' as kind,
       c.table_name,
       c.ordinal_position::text as ord,
       c.column_name as name,
       c.data_type
         || coalesce('(' || c.character_maximum_length || ')', '')
         || case when c.is_nullable = 'NO' then ' NOT NULL' else '' end
         || coalesce(' default ' || c.column_default, '') as detail
from information_schema.columns c
join t on t.name = c.table_name
where c.table_schema = 'public'

union all
-- 3b. RLS enabled / forced per table
select 'rls' as kind,
       cl.relname as table_name,
       '' as ord,
       '' as name,
       'rls_enabled=' || cl.relrowsecurity || ', rls_forced=' || cl.relforcerowsecurity as detail
from pg_class cl
join pg_namespace n on n.oid = cl.relnamespace
join t on t.name = cl.relname
where n.nspname = 'public'

union all
-- 3c. Policies: command + USING / WITH CHECK expressions + roles
select 'policy' as kind,
       p.tablename as table_name,
       '' as ord,
       p.policyname as name,
       'cmd=' || p.cmd
         || ', roles=' || array_to_string(p.roles, '|')
         || ', using=' || coalesce(p.qual, '(none)')
         || ', check=' || coalesce(p.with_check, '(none)') as detail
from pg_policies p
join t on t.name = p.tablename
where p.schemaname = 'public'

order by table_name, kind, ord::int nulls first, name;
```

### What a correct result looks like (after applying 0001 to staging)
- **rls** row per table: `rls_enabled=true, rls_forced=true`.
- **policy** rows: four per table (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), each with `roles=authenticated` (or `public` depending on how the dashboard records it) and `using`/`check` of `(auth.uid() = user_id)` — INSERT has only `check`, DELETE has only `using`, UPDATE has both.
- **column** rows matching `0001_momentum_core.sql` (e.g. `momentum_entries`: `user_id uuid NOT NULL`, `date date NOT NULL`, `answers jsonb NOT NULL default '{}'::jsonb`, `updated_at timestamptz NOT NULL default now()`).

### Separately, confirm the anon role is locked out
```sql
-- READ-ONLY. Grants held by the anon role on the three tables (expect ZERO rows).
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and table_name in ('momentum_entries','user_questions','user_settings')
order by table_name, privilege_type;
```
Expect **no rows**. Any row means `anon` still has table access and the revoke in §0001 did not apply (or production never revoked it).

## Next
Dwight writes the two-user isolation test (anonymous denial + user-A/user-B read/write, including forged-owner upserts) against staging once this migration is applied.
