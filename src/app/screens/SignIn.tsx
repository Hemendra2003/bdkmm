import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Button } from '../components/Button.tsx';
import { Field } from '../components/Field.tsx';
import { StatusLine } from '../components/StatusLine.tsx';
import { signIn } from '../store.ts';
import { FormPanel } from '../auth/FormPanel.tsx';
import { sendAuthEmail, emailCooldown, signInWithGoogle, type EmailAction } from '../auth/api.ts';

type Mode = 'signin' | EmailAction;
export function SignIn({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const request = useRef(0);
  const locked = useRef(false);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  useEffect(() => {
    const tick = () => setCooldown(mode === 'signin' ? 0 : emailCooldown(email, mode));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [email, mode]);
  function changeMode(next: Mode) {
    request.current++;
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
  }
  async function run(action: (current: () => boolean) => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    const id = ++request.current;
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await action(() => id === request.current);
    } catch (e) {
      if (id === request.current)
        setError(e instanceof Error ? e.message : 'Could not complete this request. Try again.');
    } finally {
      locked.current = false;
      if (id === request.current) setBusy(false);
    }
  }
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await run(async (current) => {
      if (mode === 'signin') {
        try {
          const err = await signIn(email.trim(), password);
          if (err && current()) setError(err);
        } catch {
          throw new Error('Sign in failed. Please check your connection and try again.');
        }
      } else {
        await sendAuthEmail(email, mode);
        if (!current()) return;
        setMessage(
          mode === 'recovery'
            ? 'If an account exists for this email, a recovery link has been requested. Check your inbox.'
            : 'If verification is needed for this email, a new verification link has been requested.',
        );
        setCooldown(emailCooldown(email, mode));
      }
    });
  }
  return (
    <FormPanel
      title={
        mode === 'signin'
          ? 'MOMENTUM'
          : mode === 'recovery'
            ? 'Reset your password'
            : 'Resend verification'
      }
    >
      <p>
        {mode === 'signin'
          ? 'Sign in to track your daily habits'
          : mode === 'recovery'
            ? 'Enter your email to request a recovery link.'
            : 'Use the email from your original account request. Verification is only needed when your account requires it.'}
      </p>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <Field
          label="Email"
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          disabled={busy}
        />
        {mode === 'signin' && (
          <>
            <Field
              label="Password"
              id="signin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              disabled={busy}
            />
            <label>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.currentTarget.checked)}
              />{' '}
              Show password
            </label>
          </>
        )}
        {error && <StatusLine text={error} tone="error" />}
        {message && <StatusLine text={message} tone="info" />}
        <Button type="submit" fullWidth disabled={busy || cooldown > 0}>
          {busy
            ? 'Please wait…'
            : cooldown > 0
              ? `Try again in ${cooldown}s`
              : mode === 'signin'
                ? 'Sign in'
                : mode === 'recovery'
                  ? 'Send recovery link'
                  : 'Resend verification email'}
        </Button>
      </form>
      {mode === 'signin' ? (
        <>
          <Button variant="secondary" disabled={busy} onClick={() => void run(signInWithGoogle)}>
            Continue with Google
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => changeMode('recovery')}>
            Forgot password?
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => changeMode('confirmation')}>
            Resend verification email
          </Button>
        </>
      ) : (
        <Button variant="ghost" disabled={busy} onClick={() => changeMode('signin')}>
          Back to sign in
        </Button>
      )}
    </FormPanel>
  );
}
