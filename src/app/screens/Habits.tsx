import { useState, useId } from 'react';
import type { QuestionRow, QuestionInput } from '../../data/repositories.ts';
import { Card } from '../components/Card.tsx';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { StatusLine } from '../components/StatusLine.tsx';

interface HabitsProps {
  questions: QuestionRow[];
  onSave: (input: QuestionInput) => Promise<void>;
  onRemove: (key: string) => Promise<void>;
}

type Polarity = 'positive' | 'negative';
type Tier = 'S' | 'A' | 'B';

interface FormState {
  text: string;
  opt1: string;
  opt2: string;
  opt3: string;
  polarity: Polarity;
  tier: Tier;
}

const BLANK_FORM: FormState = {
  text: '',
  opt1: '',
  opt2: '',
  opt3: '',
  polarity: 'positive',
  tier: 'A',
};

const TIER_LABELS: Record<Tier, string> = {
  S: 'S — Core',
  A: 'A — Important',
  B: 'B — Supporting',
};

const POLARITY_LABELS: Record<Polarity, string> = {
  positive: 'Build (positive)',
  negative: 'Reduce (negative)',
};

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return base || `habit-${Date.now()}`;
}

function newHabitKey(text: string, existingKeys: readonly string[]): string {
  const base = slugify(text);
  const taken = new Set(existingKeys);
  let key = base;
  let suffix = 2;
  while (taken.has(key)) key = `${base}-${suffix++}`;
  return key;
}

function validateForm(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.text.trim()) errors.text = 'Habit name is required.';
  else if (form.text.length > 80) errors.text = 'Max 80 characters.';
  if (!form.opt1.trim()) errors.opt1 = 'Required.';
  else if (form.opt1.length > 80) errors.opt1 = 'Max 80 characters.';
  if (!form.opt2.trim()) errors.opt2 = 'Required.';
  else if (form.opt2.length > 80) errors.opt2 = 'Max 80 characters.';
  if (!form.opt3.trim()) errors.opt3 = 'Required.';
  else if (form.opt3.length > 80) errors.opt3 = 'Max 80 characters.';
  const opts = [form.opt1.trim(), form.opt2.trim(), form.opt3.trim()];
  if (new Set(opts).size < 3 && opts.every(Boolean)) {
    errors.opt2 = 'Options must be distinct.';
  }
  return errors;
}

interface HabitFormProps {
  initial: FormState;
  existingKey?: string;
  existingKeys?: readonly string[];
  onSave: (input: QuestionInput) => Promise<void>;
  onRemove?: () => Promise<void>;
  onCancel: () => void;
}

function HabitForm({
  initial,
  existingKey,
  existingKeys = [],
  onSave,
  onRemove,
  onCancel,
}: HabitFormProps) {
  const id = useId();
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSave() {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    setOpError(null);
    try {
      const key = existingKey ?? newHabitKey(form.text, existingKeys);
      await onSave({
        key,
        text: form.text.trim(),
        opts: [form.opt1.trim(), form.opt2.trim(), form.opt3.trim()],
        polarity: form.polarity,
        tier: form.tier,
        is_fixed: false,
        source: 'custom',
      });
      onCancel();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Could not save habit. Try again.');
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setRemoving(true);
    setOpError(null);
    try {
      await onRemove();
      onCancel();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : 'Could not remove habit. Try again.');
      setRemoving(false);
    }
  }

  const charCount = (v: string) => (v.length > 60 ? `${v.length}/80` : '');

  return (
    <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        {existingKey ? 'Edit habit' : 'New habit'}
      </p>

      <Field
        id={`${id}-text`}
        label="Habit name"
        value={form.text}
        onChange={(e) => set('text', e.target.value)}
        maxLength={80}
        placeholder="e.g. Daily walk"
        error={errors.text}
      />
      {form.text && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          {charCount(form.text)}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
          }}
        >
          Response options (least → most aligned)
        </p>
        <Field
          id={`${id}-opt1`}
          label="Option 1"
          value={form.opt1}
          onChange={(e) => set('opt1', e.target.value)}
          maxLength={80}
          placeholder="e.g. No"
          error={errors.opt1}
        />
        <Field
          id={`${id}-opt2`}
          label="Option 2"
          value={form.opt2}
          onChange={(e) => set('opt2', e.target.value)}
          maxLength={80}
          placeholder="e.g. Partially"
          error={errors.opt2}
        />
        <Field
          id={`${id}-opt3`}
          label="Option 3"
          value={form.opt3}
          onChange={(e) => set('opt3', e.target.value)}
          maxLength={80}
          placeholder="e.g. Yes, fully"
          error={errors.opt3}
        />
      </div>

      {/* Polarity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
          }}
        >
          Type
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(['positive', 'negative'] as Polarity[]).map((p) => (
            <label
              key={p}
              className="radio-option"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-2)',
                border: `1px solid ${form.polarity === p ? 'var(--color-gold)' : 'var(--surface-border)'}`,
                background: form.polarity === p ? 'var(--gold-a07)' : 'transparent',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                minHeight: 'var(--touch-min)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: form.polarity === p ? 'var(--color-gold)' : 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              <input
                type="radio"
                name={`${id}-polarity`}
                value={p}
                checked={form.polarity === p}
                onChange={() => set('polarity', p)}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
              />
              {POLARITY_LABELS[p]}
            </label>
          ))}
        </div>
      </div>

      {/* Tier */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
          }}
        >
          Importance
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(['S', 'A', 'B'] as Tier[]).map((t) => (
            <label
              key={t}
              className="radio-option"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-2)',
                border: `1px solid ${form.tier === t ? 'var(--color-gold)' : 'var(--surface-border)'}`,
                background: form.tier === t ? 'var(--gold-a07)' : 'transparent',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                minHeight: 'var(--touch-min)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: form.tier === t ? 'var(--color-gold)' : 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              <input
                type="radio"
                name={`${id}-tier`}
                value={t}
                checked={form.tier === t}
                onChange={() => set('tier', t)}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
              />
              {TIER_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      {opError && <StatusLine text={opError} tone="error" />}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={saving || removing}
          style={{ flex: 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={saving || removing}
          style={{ flex: 1 }}
        >
          Cancel
        </Button>
        {onRemove && (
          <Button
            variant="ghost"
            onClick={() => void handleRemove()}
            disabled={saving || removing}
            style={{ flex: '0 0 auto', color: 'var(--color-error)' }}
          >
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function fromQuestion(q: QuestionRow): FormState {
  return {
    text: q.text,
    opt1: q.opts[0],
    opt2: q.opts[1],
    opt3: q.opts[2],
    polarity: q.polarity,
    tier: q.tier,
  };
}

export function Habits({ questions, onSave, onRemove }: HabitsProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 'var(--max-width)',
        margin: '0 auto',
        width: '100%',
        padding: 'var(--space-4)',
        gap: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          Habits
        </h1>
        {!creating && editingKey === null && (
          <Button
            variant="secondary"
            onClick={() => setCreating(true)}
            style={{ fontSize: 'var(--text-xs)', minHeight: 36, padding: '0 var(--space-3)' }}
          >
            + Add habit
          </Button>
        )}
      </div>

      {questions.length === 0 && !creating && (
        <Card padding="lg" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            No habits yet. Add your first habit to start tracking.
          </p>
        </Card>
      )}

      {questions.map((q) =>
        editingKey === q.key ? (
          <HabitForm
            key={q.key}
            initial={fromQuestion(q)}
            existingKey={q.key}
            onSave={onSave}
            onRemove={() => onRemove(q.key)}
            onCancel={() => setEditingKey(null)}
          />
        ) : (
          <button
            key={q.key}
            type="button"
            onClick={() => {
              setCreating(false);
              setEditingKey(q.key);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Card
              padding="md"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-2)',
                }}
              >
                <p
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    lineHeight: 'var(--leading-sm)',
                  }}
                >
                  {q.text}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1px 4px',
                    }}
                  >
                    {q.tier}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color:
                        q.polarity === 'positive' ? 'var(--color-green)' : 'var(--color-negred)',
                      border: `1px solid ${q.polarity === 'positive' ? 'var(--green-a30)' : 'var(--negred-a18)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '1px 4px',
                    }}
                  >
                    {q.polarity === 'positive' ? 'Build' : 'Reduce'}
                  </span>
                </div>
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                {q.opts.join(' · ')}
              </p>
            </Card>
          </button>
        ),
      )}

      {creating && (
        <HabitForm
          initial={BLANK_FORM}
          existingKeys={questions.map((question) => question.key)}
          onSave={onSave}
          onCancel={() => setCreating(false)}
        />
      )}
    </main>
  );
}
