import type { AppState } from '../store.ts';
import { Card } from '../components/Card.tsx';
import { StatusLine } from '../components/StatusLine.tsx';
import type { QuestionRow } from '../../data/repositories.ts';

interface TodayProps {
  state: AppState;
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

function answerLabel(question: QuestionRow, value: 1 | 2 | 3 | null): string {
  if (value === null) return '—';
  return question.opts[value - 1];
}

export function Today({ state }: TodayProps) {
  if (state.status === 'loading') {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-4)',
        }}
      >
        <StatusLine text="Loading your data…" tone="muted" />
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          padding: 'var(--space-4)',
        }}
      >
        <StatusLine text={state.loadError ?? 'Something went wrong.'} tone="error" />
      </main>
    );
  }

  const { questions, todayEntry, todayKey } = state;
  const isLogged = todayEntry !== null;

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
      <header>
        {todayKey && (
          <p
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {formatDate(todayKey)}
          </p>
        )}
      </header>

      <section aria-label="Today's status">
        <Card
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
          padding="md"
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 'var(--text-xl)',
              lineHeight: 1,
            }}
          >
            {isLogged ? '✅' : '📋'}
          </span>
          <p style={{ color: isLogged ? 'var(--color-green)' : 'var(--text-secondary)' }}>
            {isLogged ? "Today's check-in is recorded." : 'No check-in logged yet for today.'}
          </p>
        </Card>
      </section>

      <section aria-label="Your questions">
        <h2
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Questions ({questions.length})
        </h2>

        {questions.length === 0 ? (
          <Card padding="md">
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
              No questions configured yet.
            </p>
          </Card>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            {questions.map((q) => {
              const answer = todayEntry?.answers[q.key] ?? null;
              return (
                <li key={q.key}>
                  <Card
                    padding="md"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {q.text}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-xs)',
                        color:
                          answer === null
                            ? 'var(--text-muted)'
                            : q.polarity === 'positive'
                              ? 'var(--color-green)'
                              : 'var(--color-negred)',
                      }}
                    >
                      {answerLabel(q, answer)}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
