import { useState, useEffect, useCallback, useId } from 'react';
import type { QuestionRow, Answers, Answer } from '../../data/repositories.ts';
import { Card } from '../components/Card.tsx';
import { Button } from '../components/Button.tsx';
import { StatusLine } from '../components/StatusLine.tsx';

interface CheckInProps {
  questions: QuestionRow[];
  initialAnswers: Answers | null;
  todayKey: string;
  userId: string;
  onSave: (answers: Answers) => Promise<void>;
  onClose: () => void;
}

function draftStorageKey(userId: string, todayKey: string): string {
  return `md:draft:${userId}:${todayKey}`;
}

function loadDraft(userId: string, todayKey: string): Answers | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(userId, todayKey));
    if (!raw) return null;
    return JSON.parse(raw) as Answers;
  } catch {
    return null;
  }
}

function persistDraft(userId: string, todayKey: string, answers: Answers): void {
  try {
    localStorage.setItem(draftStorageKey(userId, todayKey), JSON.stringify(answers));
  } catch {
    // storage unavailable — continue without draft
  }
}

function clearDraft(userId: string, todayKey: string): void {
  try {
    localStorage.removeItem(draftStorageKey(userId, todayKey));
  } catch {}
}

function formatDate(key: string): string {
  try {
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(year, month - 1, day));
  } catch {
    return key;
  }
}

interface RadioGroupProps {
  question: QuestionRow;
  answer: Answer;
  onChange: (val: Answer) => void;
  onSkip: () => void;
  groupId: string;
}

function RadioGroup({ question, answer, onChange, onSkip, groupId }: RadioGroupProps) {
  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            lineHeight: 'var(--leading-sm)',
          }}
        >
          {question.text}
        </p>
        <div
          role="radiogroup"
          aria-label={question.text}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          {question.opts.map((opt, i) => {
            const val = (i + 1) as Answer;
            const checked = answer === val;
            const inputId = `${groupId}-opt${i}`;
            return (
              <label
                key={i}
                htmlFor={inputId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${checked ? 'var(--color-gold)' : 'var(--surface-border)'}`,
                  background: checked ? 'var(--gold-a07)' : 'transparent',
                  cursor: 'pointer',
                  minHeight: 'var(--touch-min)',
                  transition: 'border-color var(--duration-fast), background var(--duration-fast)',
                }}
              >
                <input
                  type="radio"
                  id={inputId}
                  name={groupId}
                  value={String(val)}
                  checked={checked}
                  onChange={() => onChange(val)}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
                {/* Non-color indicator: filled square when selected, outlined when not */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  {checked ? (
                    <rect x="0" y="0" width="12" height="12" fill="var(--color-gold)" />
                  ) : (
                    <rect
                      x="1"
                      y="1"
                      width="10"
                      height="10"
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="1.5"
                    />
                  )}
                </svg>
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: checked ? 'var(--color-gold)' : 'var(--text-secondary)',
                    lineHeight: 'var(--leading-sm)',
                  }}
                >
                  {opt}
                </span>
              </label>
            );
          })}
        </div>
        {answer !== null && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              textAlign: 'left',
              letterSpacing: '.04em',
              textDecoration: 'underline',
            }}
          >
            Skip for now
          </button>
        )}
      </div>
    </Card>
  );
}

export function CheckIn({
  questions,
  initialAnswers,
  todayKey,
  userId,
  onSave,
  onClose,
}: CheckInProps) {
  const baseId = useId();

  const [answers, setAnswers] = useState<Answers>(() => {
    const draft = loadDraft(userId, todayKey);
    return draft ?? initialAnswers ?? {};
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    persistDraft(userId, todayKey, answers);
  }, [userId, todayKey, answers]);

  const setAnswer = useCallback((key: string, val: Answer) => {
    setAnswers((prev) => ({ ...prev, [key]: val }));
  }, []);

  const skipQuestion = useCallback((key: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const answeredCount = questions.filter((q) => answers[q.key] != null).length;
  const totalCount = questions.length;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(answers);
      clearDraft(userId, todayKey);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "We couldn't sync your check-in. Retry.");
      setSaving(false);
    }
  }

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
      {/* Date + answered progress */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        <p
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
          }}
        >
          {formatDate(todayKey)}
        </p>
        {totalCount > 0 && (
          <p
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: answeredCount === totalCount ? 'var(--color-green)' : 'var(--text-muted)',
              letterSpacing: '.04em',
              flexShrink: 0,
            }}
          >
            {answeredCount} / {totalCount} answered
          </p>
        )}
      </div>

      {/* Questions */}
      {questions.map((q, idx) => (
        <RadioGroup
          key={q.key}
          question={q}
          answer={answers[q.key] ?? null}
          onChange={(val) => setAnswer(q.key, val)}
          onSkip={() => skipQuestion(q.key)}
          groupId={`${baseId}q${idx}`}
        />
      ))}

      {totalCount === 0 && (
        <Card padding="md">
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            No habits set up yet. Add habits in the Habits tab first.
          </p>
        </Card>
      )}

      {/* Partial-score notice */}
      {totalCount > 0 && answeredCount > 0 && answeredCount < totalCount && (
        <p
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '.04em',
          }}
        >
          {totalCount - answeredCount} unanswered · Score will remain pending.
        </p>
      )}

      {saveError && <StatusLine text={saveError} tone="error" />}

      {/* Save footer — sticky above the bottom nav */}
      <div
        style={{
          position: 'sticky',
          bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px))',
          background: 'var(--surface-page)',
          borderTop: '1px solid var(--surface-border)',
          padding: 'var(--space-3) 0',
          marginTop: 'auto',
        }}
      >
        <Button variant="primary" fullWidth onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save check-in'}
        </Button>
      </div>
    </main>
  );
}
