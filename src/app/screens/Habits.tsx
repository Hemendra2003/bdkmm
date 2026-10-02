import { Card } from '../components/Card.tsx';

export function Habits() {
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
        gap: 'var(--space-6)',
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
      <Card
        padding="lg"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Habit management coming in a future update.
        </p>
      </Card>
    </main>
  );
}
