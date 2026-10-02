import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Field } from '../components/Field.tsx';
import { StatusLine } from '../components/StatusLine.tsx';
import { signIn } from '../store.ts';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const err = await signIn(email.trim(), password);
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        minHeight: '100dvh',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '390px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
        padding="lg"
      >
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 'var(--text-lg)',
              color: 'var(--color-gold)',
              marginBottom: 'var(--space-2)',
            }}
          >
            MOMENTUM
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Sign in to track your daily habits
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          noValidate
        >
          <Field
            label="Email"
            id="signin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <Field
            label="Password"
            id="signin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />

          {error && <StatusLine text={error} tone="error" />}

          <Button type="submit" fullWidth disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
