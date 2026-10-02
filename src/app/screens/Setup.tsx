import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { QuestionInput } from '../../data/repositories.ts';
import { getState, getAuthContext, isAuthContextCurrent } from '../store.ts';
import { starterPreset, saveStarterPreset, skipSetup } from '../auth/setup.ts';
import { FormPanel } from '../auth/FormPanel.tsx';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { StatusLine } from '../components/StatusLine.tsx';

export function Setup({ onComplete }: { onComplete: (saved: boolean) => void }) {
  const [questions, setQuestions] = useState(starterPreset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function edit(index: number, patch: Partial<QuestionInput>) {
    setQuestions((values) => values.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const context = getAuthContext();
    try {
      await saveStarterPreset(questions);
      if (alive.current && isAuthContextCurrent(context)) setSaved(true);
    } catch {
      if (alive.current && isAuthContextCurrent(context))
        setError('Your routine could not be saved. Check your connection and try again.');
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function skip() {
    const userId = getState().userId;
    if (!userId) return;
    skipSetup(userId);
    onComplete(false);
  }
  return (
    <FormPanel title="Choose your routine">
      {saved ? (
        <>
          <StatusLine text="Your routine is saved." tone="info" />
          <Button onClick={() => onComplete(true)}>Start your first check-in</Button>
        </>
      ) : (
        <>
          <p>
            This optional starter has 2 habits to build and 2 to reduce. Edit it, accept it, or skip
            for now. Nothing is added until you save.
          </p>
          <p>
            Check-ins use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          </p>
          <form
            onSubmit={(e) => void submit(e)}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            {questions.map((q, index) => (
              <fieldset
                key={q.key}
                disabled={busy}
                style={{
                  border: '1px solid var(--surface-border)',
                  padding: 'var(--space-3)',
                  display: 'grid',
                  gap: 'var(--space-3)',
                }}
              >
                <legend>Habit {index + 1}</legend>
                <Field
                  label={`Habit ${index + 1} name`}
                  maxLength={80}
                  required
                  value={q.text}
                  onChange={(e) => edit(index, { text: e.currentTarget.value })}
                />
                <label>
                  Direction{' '}
                  <select
                    aria-label={`Habit ${index + 1} direction`}
                    value={q.polarity}
                    onChange={(e) =>
                      edit(index, { polarity: e.currentTarget.value as QuestionInput['polarity'] })
                    }
                  >
                    <option value="positive">Build a habit</option>
                    <option value="negative">Reduce a habit</option>
                  </select>
                </label>
                <label>
                  Importance{' '}
                  <select
                    aria-label={`Habit ${index + 1} importance`}
                    value={q.tier}
                    onChange={(e) =>
                      edit(index, { tier: e.currentTarget.value as QuestionInput['tier'] })
                    }
                  >
                    <option value="S">High</option>
                    <option value="A">Medium</option>
                    <option value="B">Low</option>
                  </select>
                </label>
                {q.opts.map((option, i) => (
                  <Field
                    key={i}
                    label={`Habit ${index + 1} choice ${i + 1}`}
                    required
                    maxLength={80}
                    value={option}
                    onChange={(e) => {
                      const opts = [...q.opts] as [string, string, string];
                      opts[i] = e.currentTarget.value;
                      edit(index, { opts });
                    }}
                  />
                ))}
              </fieldset>
            ))}
            {error && <StatusLine text={error} tone="error" />}
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving routine…' : 'Use this routine'}
            </Button>
          </form>
          <Button variant="ghost" disabled={busy} onClick={skip}>
            Skip for now
          </Button>
        </>
      )}
    </FormPanel>
  );
}
