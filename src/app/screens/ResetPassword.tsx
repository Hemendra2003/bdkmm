import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { StatusLine } from '../components/StatusLine.tsx';
import { FormPanel } from '../auth/FormPanel.tsx';
import { updateRecoveryPassword } from '../auth/api.ts';
import { finishRecovery, type AppState } from '../store.ts';
import { SignIn } from './SignIn.tsx';

export function ResetPassword({
  state,
  onComplete = finishRecovery,
}: {
  state: AppState;
  onComplete?: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [requestNew, setRequestNew] = useState(false);
  const alive = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setPassword('');
    setConfirm('');
    setSaved(false);
    setError('');
  }, [state.userId]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (locked.current) return;
    setError('');
    if (password !== confirm) {
      setError('Passwords must match.');
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      await updateRecoveryPassword(password);
      if (alive.current) {
        setPassword('');
        setConfirm('');
        setSaved(true);
      }
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Password could not be updated. Request a new recovery link.',
        );
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (requestNew) return <SignIn initialMode="recovery" />;
  return (
    <FormPanel title="Choose a new password">
      {saved ? (
        <>
          <StatusLine text="Your password has been updated." tone="info" />
          <Button onClick={onComplete}>Return to Today</Button>
        </>
      ) : state.recoveryReady ? (
        <form
          onSubmit={(e) => void submit(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <p>Use at least 8 characters.</p>
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Field
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            disabled={busy}
            onChange={(e) => setConfirm(e.currentTarget.value)}
          />
          {error && <StatusLine text={error} tone="error" />}
          <Button type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      ) : state.status === 'loading' ? (
        <StatusLine text="Checking your recovery link…" />
      ) : (
        <>
          <StatusLine
            text="This recovery link is unavailable or expired. Request a new link."
            tone="error"
          />
          <Button onClick={() => setRequestNew(true)}>Request a new link</Button>
        </>
      )}
    </FormPanel>
  );
}
