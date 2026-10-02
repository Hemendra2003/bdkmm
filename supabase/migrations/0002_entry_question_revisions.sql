-- WP2.5: self-contained immutable question-set revision per entry.
-- Additive: existing rows stay NULL/NULL (unknown historical definitions).
-- Apply only to staging through the release owner; this file performs no calls.
begin;
alter table public.momentum_entries
  add column if not exists question_set_revision jsonb,
  add column if not exists engine_version text;

-- No new table/grants: momentum_entries retains 0001 forced owner-only RLS.
-- Invoker function, fixed search path; no elevated privileges or anon grants.
create or replace function public.freeze_entry_question_revision()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if TG_OP = 'UPDATE' and OLD.question_set_revision is not null then
    -- Corrections can change answers, but cannot rewrite the original definitions/version.
    NEW.question_set_revision := OLD.question_set_revision;
    NEW.engine_version := OLD.engine_version;
  else
    if NEW.question_set_revision is null then
      -- Backward-compatible old clients: capture current owner definitions at receipt.
      -- An edited legacy row establishes a baseline NOW, not reconstructed history.
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', q.key, 'text', q.text, 'polarity', q.polarity, 'tier', q.tier
      ) order by q.sort_order, q.key), '[]'::jsonb)
      into NEW.question_set_revision
      from public.user_questions q where q.user_id = NEW.user_id;
    end if;
    NEW.engine_version := coalesce(NEW.engine_version, 'b-1');
  end if;
  if NEW.engine_version <> 'b-1' or jsonb_typeof(NEW.question_set_revision) <> 'array' then
    raise exception 'Unsupported engine or invalid question revision' using errcode = '23514';
  end if;
  if jsonb_array_length(NEW.question_set_revision) > 1000 then
    raise exception 'Too many revision questions' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(NEW.question_set_revision) q
    where jsonb_typeof(q) <> 'object'
      or jsonb_typeof(q->'key') is distinct from 'string'
      or length(q->>'key') not between 1 and 128
      or btrim(q->>'key') = '' or q->>'key' in ('__proto__','constructor','prototype')
      or jsonb_typeof(q->'text') is distinct from 'string'
      or length(q->>'text') not between 1 and 4096 or btrim(q->>'text') = ''
      or coalesce(q->>'polarity', '') not in ('positive','negative')
      or coalesce(q->>'tier', '') not in ('S','A','B')
  ) or (select count(*) from jsonb_array_elements(NEW.question_set_revision)) <>
       (select count(distinct q->>'key') from jsonb_array_elements(NEW.question_set_revision) q) then
    raise exception 'Invalid question revision definitions' using errcode = '23514';
  end if;
  return NEW;
end;
$$;
revoke all on function public.freeze_entry_question_revision() from public, anon;
create or replace trigger momentum_entries_freeze_revision
  before insert or update on public.momentum_entries
  for each row execute function public.freeze_entry_question_revision();
commit;
