import type { SupabaseClient } from '@supabase/supabase-js';

export type Answer = 1 | 2 | 3 | null;
export type Answers = Record<string, Answer>;
export interface RevisionQuestion {
  key: string;
  text: string;
  polarity: 'positive' | 'negative';
  tier: 'S' | 'A' | 'B';
}
export interface EntryMetadata {
  question_set_revision?: readonly RevisionQuestion[] | null;
  engine_version?: string | null;
  revision_invalid?: boolean;
}
export interface EntryInput extends EntryMetadata {
  date: string;
  answers: Answers;
  user_id?: string;
}
export interface EntryRow extends EntryMetadata {
  date: string;
  answers: Answers;
  updated_at: string | null;
}
export interface QuestionRow {
  id: string | number;
  key: string;
  text: string;
  opts: [string, string, string];
  polarity: 'positive' | 'negative';
  tier: 'S' | 'A' | 'B';
  is_fixed: boolean;
  source: 'library' | 'custom';
  sort_order: number;
}
export type QuestionInput = Omit<QuestionRow, 'id' | 'is_fixed' | 'source' | 'sort_order'> & {
  is_fixed?: boolean;
  source?: QuestionRow['source'];
  sort_order?: number;
};
export interface SettingsRow {
  legacy_migrated: boolean;
  migrated_at: string | null;
}
export interface RepositoryDependencies {
  client: Pick<SupabaseClient, 'from'>;
  getUserId: () => unknown;
  now: () => Date;
  warn?: (issue: ReadIssue) => void;
}

export interface ReadDiagnostics {
  normalizedFields: number;
  droppedFields: number;
  droppedRows: number;
}
export interface ReadIssue {
  table: 'entries' | 'questions' | 'settings';
  identifier: string;
  field: string;
  action: 'normalizedFields' | 'droppedFields' | 'droppedRows';
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${field}.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error(`Invalid ${field}.`);
  return value;
}
function key(value: unknown): string {
  const result = text(value, 'question key', 128);
  if (['__proto__', 'constructor', 'prototype'].includes(result))
    throw new Error('Invalid question key.');
  return result;
}
function dateKey(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Invalid entry date.');
  const parsed = new Date(value + 'T12:00:00Z');
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(value.slice(0, 4)) ||
    parsed.getUTCMonth() + 1 !== Number(value.slice(5, 7)) ||
    parsed.getUTCDate() !== Number(value.slice(8, 10))
  )
    throw new Error('Invalid entry date.');
  return value;
}
function timestamp(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error(`Invalid ${field}.`);
  return value;
}
function answers(value: unknown): Answers {
  const source = object(value, 'entry answers');
  const items = Object.entries(source);
  if (items.length > 1000) throw new Error('Too many entry answers.');
  for (const [name, answer] of items) {
    key(name);
    if (answer !== null && answer !== 1 && answer !== 2 && answer !== 3)
      throw new Error('Invalid answer choice.');
  }
  return Object.fromEntries(items) as Answers;
}
function owned(row: Record<string, unknown>, userId: string): void {
  if ('user_id' in row && row.user_id !== userId)
    throw new Error('Row belongs to a different account.');
}
function revision(value: unknown): RevisionQuestion[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Invalid question revision.');
  const result = value.map((value) => {
    const row = object(value, 'revision question');
    if (row.polarity !== 'positive' && row.polarity !== 'negative')
      throw new Error('Invalid revision polarity.');
    if (row.tier !== 'S' && row.tier !== 'A' && row.tier !== 'B')
      throw new Error('Invalid revision tier.');
    return {
      key: key(row.key),
      text: text(row.text, 'revision text', 4096),
      polarity: row.polarity,
      tier: row.tier,
    } as RevisionQuestion;
  });
  distinct(result, 'key');
  return result;
}
function metadata(row: Record<string, unknown>): EntryMetadata {
  if (row.question_set_revision == null && row.engine_version == null) return {};
  if (row.engine_version !== 'b-1') throw new Error('Unsupported entry engine version.');
  return { question_set_revision: revision(row.question_set_revision), engine_version: 'b-1' };
}
function writeMetadata(row: Record<string, unknown>): EntryMetadata {
  if (row.revision_invalid) throw new Error('Invalid entry revision.');
  if (row.question_set_revision == null && row.engine_version == null) return {};
  return metadata(row);
}
function entryRow(value: unknown, userId: string): EntryRow {
  const row = object(value, 'entry row');
  owned(row, userId);
  return {
    date: dateKey(row.date),
    answers: answers(row.answers),
    updated_at: timestamp(row.updated_at, 'entry timestamp'),
    ...metadata(row),
  };
}
function questionFields(value: unknown, userId: string, writing: boolean): Omit<QuestionRow, 'id'> {
  const row = object(value, 'question');
  owned(row, userId);
  const limit = writing ? 80 : 4096; // Safely display pre-existing long labels; new writes retain P0.4 limits.
  const opts = row.opts;
  if (!Array.isArray(opts) || opts.length !== 3) throw new Error('Invalid question options.');
  const validatedOpts = opts.map((option) => text(option, 'option label', limit)) as [
    string,
    string,
    string,
  ];
  if (row.polarity !== 'positive' && row.polarity !== 'negative')
    throw new Error('Invalid question polarity.');
  if (row.tier !== 'S' && row.tier !== 'A' && row.tier !== 'B')
    throw new Error('Invalid question tier.');
  const fixed = writing && row.is_fixed === undefined ? false : row.is_fixed;
  const source = writing && row.source === undefined ? 'custom' : row.source;
  const order = writing && row.sort_order === undefined ? 0 : row.sort_order;
  if (typeof fixed !== 'boolean') throw new Error('Invalid fixed-question flag.');
  if (source !== 'library' && source !== 'custom') throw new Error('Invalid question source.');
  if (typeof order !== 'number' || !Number.isSafeInteger(order) || order < 0)
    throw new Error('Invalid question order.');
  return {
    key: key(row.key),
    text: text(row.text, 'question text', limit),
    opts: validatedOpts,
    polarity: row.polarity,
    tier: row.tier,
    is_fixed: fixed,
    source,
    sort_order: order,
  };
}
function questionRow(value: unknown, userId: string): QuestionRow {
  const row = object(value, 'question row');
  const fields = questionFields(row, userId, false);
  if (
    !(typeof row.id === 'string' && row.id.trim() && row.id.length <= 128) &&
    !(typeof row.id === 'number' && Number.isSafeInteger(row.id) && row.id >= 0)
  )
    throw new Error('Invalid question id.');
  return { id: row.id as string | number, ...fields };
}
function settingsRow(value: unknown, userId: string): SettingsRow {
  const row = object(value, 'settings row');
  owned(row, userId);
  if (typeof row.legacy_migrated !== 'boolean') throw new Error('Invalid migration flag.');
  return {
    legacy_migrated: row.legacy_migrated,
    migrated_at: timestamp(row.migrated_at, 'migration timestamp'),
  };
}
function list<T>(value: unknown, parse: (row: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('Expected a list of rows.');
  return value.map(parse);
}
function distinct(rows: readonly { date?: string; key?: string }[], field: 'date' | 'key'): void {
  if (new Set(rows.map((row) => row[field])).size !== rows.length)
    throw new Error('Duplicate records in batch.');
}

// Client, current-account accessor and clock are injected. This module never
// accesses browser globals or chooses a session. RLS remains the authority.
export function createRepositories({
  client,
  getUserId,
  now,
  warn = (issue) => console.warn('Momentum data read:', issue),
}: RepositoryDependencies) {
  let diagnosticsOwner: string | null = null;
  let diagnostics: ReadDiagnostics = { normalizedFields: 0, droppedFields: 0, droppedRows: 0 };
  function requireUserId(): string {
    const userId = text(getUserId(), 'signed-in user', 128);
    if (diagnosticsOwner !== userId) {
      diagnosticsOwner = userId;
      diagnostics = { normalizedFields: 0, droppedFields: 0, droppedRows: 0 };
    }
    return userId;
  }
  function sameUser(userId: string): void {
    if (getUserId() !== userId) throw new Error('Account changed during the request.');
  }

  function resetReadDiagnostics(): void {
    diagnosticsOwner = null;
    diagnostics = { normalizedFields: 0, droppedFields: 0, droppedRows: 0 };
  }
  function getReadDiagnostics(): ReadDiagnostics {
    requireUserId();
    return { ...diagnostics };
  }
  function issue(
    table: ReadIssue['table'],
    value: unknown,
    field: string,
    action: ReadIssue['action'],
  ): void {
    const row =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const candidate = table === 'entries' ? row.date : table === 'questions' ? row.key : 'settings';
    // Log only bounded identifiers; never labels, answer values, account IDs or raw rows.
    const identifier =
      typeof candidate === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(candidate)
        ? candidate
        : '[invalid]';
    diagnostics[action]++;
    warn({ table, identifier, field, action });
  }
  function readRow<T>(
    value: unknown,
    userId: string,
    table: ReadIssue['table'],
    parse: (row: Record<string, unknown>) => T,
  ): T | null {
    // Ownership errors must never enter the corruption fallback, even on an otherwise invalid row.
    if (value && typeof value === 'object' && !Array.isArray(value))
      owned(value as Record<string, unknown>, userId);
    try {
      return parse(object(value, 'read row'));
    } catch {
      issue(table, value, 'row', 'droppedRows');
      return null;
    }
  }
  function readEntry(value: unknown, userId: string): EntryRow | null {
    return readRow(value, userId, 'entries', (row) => {
      const date = dateKey(row.date);
      const source = object(row.answers, 'entry answers');
      if (Object.keys(source).length > 1000) throw new Error('Too many entry answers.');
      const items: [string, Answer][] = [];
      for (const [name, original] of Object.entries(source)) {
        try {
          key(name);
          // Number accepts whitespace/decimal numeric spellings but no partial parseInt coercion.
          const answer =
            typeof original === 'string' && original.trim() ? Number(original) : original;
          if (answer !== null && answer !== 1 && answer !== 2 && answer !== 3)
            throw new Error('Invalid answer choice.');
          items.push([name, answer]);
          if (answer !== original) issue('entries', row, 'answer', 'normalizedFields');
        } catch {
          issue('entries', row, 'answer', 'droppedFields');
        }
      }
      let updated_at: string | null = null;
      try {
        updated_at = timestamp(row.updated_at, 'entry timestamp');
      } catch {
        issue('entries', row, 'updated_at', 'droppedFields');
      }
      let stored: EntryMetadata;
      try {
        stored = metadata(row);
      } catch {
        issue('entries', row, 'revision', 'droppedFields');
        // Preserve an explicit failure marker: never silently score corrupt stamped history with live definitions.
        stored = { revision_invalid: true };
      }
      return { date, answers: Object.fromEntries(items), updated_at, ...stored };
    });
  }
  function readList<T>(value: unknown, parse: (row: unknown) => T | null): T[] {
    if (!Array.isArray(value)) throw new Error('Expected a list of rows.');
    return value.map(parse).filter((row): row is T => row !== null);
  }
  const entryColumns = 'date,answers,updated_at,question_set_revision,engine_version';
  const questionColumns = 'id,key,text,opts,polarity,tier,is_fixed,source,sort_order';
  const entries = {
    async list(): Promise<EntryRow[]> {
      const userId = requireUserId();
      const { data, error } = await client
        .from('momentum_entries')
        .select(entryColumns)
        .eq('user_id', userId)
        .order('date', { ascending: true });
      if (error) throw error;
      sameUser(userId);
      return readList(data, (row) => readEntry(row, userId));
    },
    async get(date: string): Promise<EntryRow | null> {
      const userId = requireUserId(),
        target = dateKey(date);
      const { data, error } = await client
        .from('momentum_entries')
        .select(entryColumns)
        .eq('user_id', userId)
        .eq('date', target)
        .maybeSingle();
      if (error) throw error;
      sameUser(userId);
      if (data === null) return null;
      // Missing response data is a protocol failure, not evidence of absence.
      if (data === undefined) throw new Error('Missing entry result.');
      const row = readEntry(data, userId);
      if (row && row.date !== target) throw new Error('Unexpected entry date.');
      return row;
    },
    async save(
      date: string,
      values: Answers,
      questions?: readonly RevisionQuestion[],
    ): Promise<EntryRow> {
      const userId = requireUserId();
      const payload = {
        user_id: userId,
        date: dateKey(date),
        answers: answers(values),
        ...(questions === undefined
          ? {}
          : { question_set_revision: revision(questions), engine_version: 'b-1' }),
      };
      const { data, error } = await client
        .from('momentum_entries')
        .upsert(payload, { onConflict: 'user_id,date' })
        .eq('user_id', userId)
        .select(entryColumns)
        .single();
      if (error) throw error;
      sameUser(userId);
      const row = entryRow(data, userId);
      if (row.date !== payload.date) throw new Error('Unexpected entry date.');
      return row;
    },
    async removeAll(): Promise<true> {
      const userId = requireUserId();
      const { error } = await client.from('momentum_entries').delete().eq('user_id', userId);
      if (error) throw error;
      sameUser(userId);
      return true;
    },
    async import(value: readonly EntryInput[]): Promise<EntryRow[]> {
      const userId = requireUserId();
      const rows = list(value, (value) => {
        const row = object(value, 'imported entry');
        owned(row, userId);
        return {
          user_id: userId,
          date: dateKey(row.date),
          answers: answers(row.answers),
          ...writeMetadata(row),
        };
      });
      distinct(rows, 'date');
      if (!rows.length) return [];
      const { data, error } = await client
        .from('momentum_entries')
        .upsert(rows, { onConflict: 'user_id,date' })
        .eq('user_id', userId)
        .select(entryColumns);
      if (error) throw error;
      sameUser(userId);
      const result = list(data, (row) => entryRow(row, userId));
      if (
        result.length !== rows.length ||
        result.some((row) => !rows.some((input) => input.date === row.date))
      )
        throw new Error('Incomplete entry batch result.');
      distinct(result, 'date');
      return result;
    },
  };
  const questions = {
    async list(): Promise<QuestionRow[]> {
      const userId = requireUserId();
      const { data, error } = await client
        .from('user_questions')
        .select(questionColumns)
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      sameUser(userId);
      return readList(data, (row) =>
        readRow(row, userId, 'questions', (value) => questionRow(value, userId)),
      );
    },
    async save(value: QuestionInput): Promise<QuestionRow> {
      const userId = requireUserId();
      const payload = { user_id: userId, ...questionFields(value, userId, true) };
      const { data, error } = await client
        .from('user_questions')
        .upsert(payload, { onConflict: 'user_id,key' })
        .eq('user_id', userId)
        .select(questionColumns)
        .single();
      if (error) throw error;
      sameUser(userId);
      const row = questionRow(data, userId);
      if (row.key !== payload.key) throw new Error('Unexpected question key.');
      return row;
    },
    async saveMany(value: readonly QuestionInput[]): Promise<QuestionRow[]> {
      const userId = requireUserId();
      const rows = list(value, (row) => ({
        user_id: userId,
        ...questionFields(row, userId, true),
      }));
      distinct(rows, 'key');
      if (!rows.length) return [];
      const { data, error } = await client
        .from('user_questions')
        .upsert(rows, { onConflict: 'user_id,key' })
        .eq('user_id', userId)
        .select(questionColumns);
      if (error) throw error;
      sameUser(userId);
      const result = list(data, (row) => questionRow(row, userId));
      if (
        result.length !== rows.length ||
        result.some((row) => !rows.some((input) => input.key === row.key))
      )
        throw new Error('Incomplete question batch result.');
      distinct(result, 'key');
      return result;
    },
    async remove(value: string): Promise<true> {
      const userId = requireUserId(),
        target = key(value);
      const { error } = await client
        .from('user_questions')
        .delete()
        .eq('user_id', userId)
        .eq('key', target);
      if (error) throw error;
      sameUser(userId);
      return true;
    },
  };
  const settings = {
    async get(): Promise<SettingsRow> {
      const userId = requireUserId();
      const { data, error } = await client
        .from('user_settings')
        .select('legacy_migrated,migrated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      sameUser(userId);
      if (data === null) return { legacy_migrated: false, migrated_at: null };
      if (data === undefined) throw new Error('Missing settings result.');
      // A corrupt migration flag must not trigger another automatic legacy import.
      return (
        readRow(data, userId, 'settings', (row) => {
          let legacy_migrated = true,
            migrated_at: string | null = null;
          if (typeof row.legacy_migrated === 'boolean') legacy_migrated = row.legacy_migrated;
          else issue('settings', row, 'legacy_migrated', 'droppedFields');
          try {
            migrated_at = timestamp(row.migrated_at, 'migration timestamp');
          } catch {
            issue('settings', row, 'migrated_at', 'droppedFields');
          }
          return { legacy_migrated, migrated_at };
        }) ?? { legacy_migrated: true, migrated_at: null }
      );
    },
    async markMigrated(): Promise<true> {
      const userId = requireUserId(),
        instant = now();
      if (!(instant instanceof Date) || !Number.isFinite(instant.getTime()))
        throw new Error('Invalid migration clock.');
      const payload = {
        user_id: userId,
        legacy_migrated: true,
        migrated_at: instant.toISOString(),
      };
      settingsRow(payload, userId);
      const { error } = await client
        .from('user_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .eq('user_id', userId);
      if (error) throw error;
      sameUser(userId);
      return true;
    },
  };
  return { requireUserId, getReadDiagnostics, resetReadDiagnostics, entries, questions, settings };
}
export type Repositories = ReturnType<typeof createRepositories>;
