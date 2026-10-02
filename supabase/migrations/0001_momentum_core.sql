-- 0001_momentum_core.sql
-- MOMENTUM core schema + Row-Level Security (RLS) for a fresh (staging) Supabase project.
-- Scope: the three tables the client already uses, exactly as src/data/repositories.ts
-- reads/writes them, with per-operation RLS and anon lockout. Idempotent where practical.
--
-- Columns/types/onConflict keys derived from src/data/repositories.ts and cross-checked
-- against hive/agents/dwight-muqntrhe/bdkmm-security-inventory.md section (c).
--
-- Apply: paste into the Supabase SQL editor of the STAGING project and run (see supabase/README.md).
-- This file makes NO network calls; it is plain SQL.

begin;

-- ============================================================================
-- momentum_entries — one row per (user, calendar date); answers is a JSON map
--   repositories.entries: select 'date,answers,updated_at' .eq('user_id') .order('date')
--                         upsert {user_id,date,answers} onConflict 'user_id,date'
--                         delete .eq('user_id').neq('date','0000-00-00')
-- ============================================================================
create table if not exists public.momentum_entries (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  date       date        not null,
  answers    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint momentum_entries_pkey primary key (user_id, date),
  constraint momentum_entries_answers_is_object check (jsonb_typeof(answers) = 'object')
);
-- PK (user_id,date) already satisfies the upsert onConflict 'user_id,date'.

-- ============================================================================
-- user_questions — each user's own question set; id is DB-generated (client never writes it)
--   repositories.questions: select 'id,key,text,opts,polarity,tier,is_fixed,source,sort_order'
--                           upsert row(s) onConflict 'user_id,key'
--                           delete .eq('user_id').eq('key')
-- ============================================================================
create table if not exists public.user_questions (
  id         bigint      generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  text       text        not null,
  opts       jsonb       not null,
  polarity   text        not null,
  tier       text        not null,
  is_fixed   boolean     not null default false,
  source     text        not null default 'custom',
  sort_order integer     not null default 0,
  constraint user_questions_user_key_unique unique (user_id, key),
  constraint user_questions_polarity_valid  check (polarity in ('positive','negative')),
  constraint user_questions_tier_valid      check (tier in ('S','A','B')),
  constraint user_questions_source_valid    check (source in ('library','custom')),
  constraint user_questions_sort_order_nonneg check (sort_order >= 0),
  -- opts must be a JSON array of exactly three elements (matches [string,string,string]).
  -- Per-element string typing is enforced by the client/repository (CHECK constraints
  -- cannot contain the subquery that element-wise type checking would require).
  constraint user_questions_opts_shape check (
    jsonb_typeof(opts) = 'array'
    and jsonb_array_length(opts) = 3
  )
);
-- The unique (user_id,key) satisfies the upsert onConflict 'user_id,key'.

-- ============================================================================
-- user_settings — one row per user; gates the one-time legacy migration
--   repositories.settings: select 'legacy_migrated,migrated_at' .eq('user_id')
--                          upsert {user_id,legacy_migrated,migrated_at} onConflict 'user_id'
-- ============================================================================
create table if not exists public.user_settings (
  user_id        uuid        not null references auth.users (id) on delete cascade,
  legacy_migrated boolean    not null default false,
  migrated_at    timestamptz,
  constraint user_settings_pkey primary key (user_id)
);
-- PK (user_id) satisfies the upsert onConflict 'user_id'.

-- ============================================================================
-- updated_at maintenance for momentum_entries (client selects updated_at and will
-- use it for optimistic concurrency later; keep it authoritative server-side).
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger momentum_entries_set_updated_at
  before insert or update on public.momentum_entries
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row-Level Security — enable + per-operation policies. auth.uid() is the
-- signed-in user's id; it is NULL for the anon role, so every policy below
-- denies anonymous access as well.
-- ============================================================================
alter table public.momentum_entries enable row level security;
alter table public.user_questions   enable row level security;
alter table public.user_settings    enable row level security;
-- Force RLS so even the table owner is subject to policies (defense in depth).
alter table public.momentum_entries force row level security;
alter table public.user_questions   force row level security;
alter table public.user_settings    force row level security;

-- momentum_entries policies
drop policy if exists momentum_entries_select on public.momentum_entries;
create policy momentum_entries_select on public.momentum_entries
  for select using (auth.uid() = user_id);
drop policy if exists momentum_entries_insert on public.momentum_entries;
create policy momentum_entries_insert on public.momentum_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists momentum_entries_update on public.momentum_entries;
create policy momentum_entries_update on public.momentum_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists momentum_entries_delete on public.momentum_entries;
create policy momentum_entries_delete on public.momentum_entries
  for delete using (auth.uid() = user_id);

-- user_questions policies
drop policy if exists user_questions_select on public.user_questions;
create policy user_questions_select on public.user_questions
  for select using (auth.uid() = user_id);
drop policy if exists user_questions_insert on public.user_questions;
create policy user_questions_insert on public.user_questions
  for insert with check (auth.uid() = user_id);
drop policy if exists user_questions_update on public.user_questions;
create policy user_questions_update on public.user_questions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists user_questions_delete on public.user_questions;
create policy user_questions_delete on public.user_questions
  for delete using (auth.uid() = user_id);

-- user_settings policies
drop policy if exists user_settings_select on public.user_settings;
create policy user_settings_select on public.user_settings
  for select using (auth.uid() = user_id);
drop policy if exists user_settings_insert on public.user_settings;
create policy user_settings_insert on public.user_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists user_settings_update on public.user_settings;
create policy user_settings_update on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists user_settings_delete on public.user_settings;
create policy user_settings_delete on public.user_settings
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- Grants — RLS restricts ROWS; grants restrict TABLE access. Give the
-- 'authenticated' role the operations the client performs, and revoke
-- everything from 'anon' (and public) as defense in depth.
-- ============================================================================
revoke all on public.momentum_entries from anon, public;
revoke all on public.user_questions   from anon, public;
revoke all on public.user_settings    from anon, public;

grant select, insert, update, delete on public.momentum_entries to authenticated;
grant select, insert, update, delete on public.user_questions   to authenticated;
grant select, insert, update, delete on public.user_settings    to authenticated;
-- user_questions.id is an identity column; the client never writes it, so no
-- sequence grant is required for the authenticated role's upserts.

commit;

-- ----------------------------------------------------------------------------
-- KNOWN CLIENT MISMATCH (documented, intentionally NOT worked around here):
-- repositories.entries.removeAll() issues  .neq('date','0000-00-00')  on a real
-- DATE column; Postgres rejects '0000-00-00' as out of range, so delete-all will
-- ERROR against this schema. This is AUDIT finding 15 and is tracked as a client
-- fix (remove the sentinel filter). The schema uses the correct DATE type on
-- purpose; do not change the column to text to accommodate the bug.
-- ----------------------------------------------------------------------------
