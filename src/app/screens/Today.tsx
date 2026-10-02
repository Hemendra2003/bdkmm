import { getDayScore, type AppState } from '../store.ts';
import { Card } from '../components/Card.tsx';
import { StatusLine } from '../components/StatusLine.tsx';
import { Button } from '../components/Button.tsx';
import { EngineCard } from '../components/EngineCard.tsx';

interface TodayProps {
  state: AppState;
  onStartCheckIn: () => void;
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

function formatLastScoredDate(date: string, todayKey: string): string {
  try {
    if (date === todayKey) return 'today';
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
      new Date(year, month - 1, day),
    );
  } catch {
    return date;
  }
}

function MomentumIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect x="6" y="0" width="4" height="2" />
      <rect x="4" y="2" width="8" height="2" />
      <rect x="4" y="4" width="8" height="6" />
      <rect x="2" y="10" width="12" height="2" />
      <rect x="5" y="12" width="6" height="2" />
      <rect x="6" y="14" width="4" height="2" />
    </svg>
  );
}

function getNudge(
  todayEntry: AppState['todayEntry'],
  lastScored: AppState['lastScored'],
  weekCheckIns: number,
  todayKey: string | null,
): string | null {
  if (todayEntry !== null) return null;
  if (lastScored === null && weekCheckIns === 0) return 'No check-ins yet. Start here.';
  if (lastScored !== null && todayKey !== null && lastScored.date < todayKey) {
    // Gap: last score was before today
    const [ly, lm, ld] = lastScored.date.split('-').map(Number);
    const [ty, tm, td] = todayKey.split('-').map(Number);
    const lastMs = Date.UTC(ly, lm - 1, ld);
    const todayMs = Date.UTC(ty, tm - 1, td);
    const daysSince = Math.round((todayMs - lastMs) / 86_400_000);
    if (daysSince > 1) return 'Welcome back. Start with today.';
  }
  return null;
}

export function Today({ state, onStartCheckIn }: TodayProps) {
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
          padding: 'var(--space-4)',
        }}
      >
        <StatusLine text={state.loadError ?? 'Something went wrong.'} tone="error" />
      </main>
    );
  }

  const { todayEntry, todayKey, lastScored, weekCheckIns } = state;
  const todayScore = todayKey ? getDayScore(todayKey) : null;
  const todayResult = todayKey ? (state.history[todayKey] ?? null) : null;
  const isPartial = todayScore?.checkInStatus === 'partial';
  const isLogged = todayEntry !== null;
  const nudge = getNudge(todayEntry, lastScored, weekCheckIns, todayKey);

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
        gap: 'var(--space-5)',
      }}
    >
      <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 'var(--text-lg)' }}>Today</h1>
      {todayKey && (
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
          }}
        >
          {formatDate(todayKey)}
        </p>
      )}

      {/* Primary action */}
      <Card padding="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: isLogged ? 'var(--color-green)' : 'var(--text-secondary)',
            }}
          >
            {isPartial
              ? 'Check-in saved · Score pending'
              : isLogged
                ? "Today's check-in is recorded."
                : 'No check-in logged yet.'}
          </p>
          <Button
            variant="primary"
            onClick={onStartCheckIn}
            style={{ minWidth: 120, fontSize: 'var(--text-xs)' }}
          >
            {isPartial ? 'Continue check-in' : isLogged ? 'Edit check-in' : 'Start check-in'}
          </Button>
        </div>
      </Card>

      {/* Today's engine result — shown when a check-in has been saved */}
      {todayResult !== null && <EngineCard result={todayResult} />}

      {/* Momentum */}
      <Card padding="md">
        {lastScored !== null ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--color-gold)',
            }}
          >
            <MomentumIcon />
            <span
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '9px',
                letterSpacing: '.04em',
                lineHeight: 1.6,
              }}
            >
              {Math.round(lastScored.velocity)} km/s
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}
            >
              · last scored {formatLastScoredDate(lastScored.date, todayKey ?? '')}
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              color: 'var(--text-muted)',
            }}
          >
            <MomentumIcon />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
              No velocity yet — score your first check-in.
            </span>
          </div>
        )}
      </Card>

      {/* Week summary */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          letterSpacing: '.04em',
        }}
      >
        Last 7 days:{' '}
        <span style={{ color: weekCheckIns > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
          {weekCheckIns === 1 ? '1 check-in' : `${weekCheckIns} check-ins`}
        </span>
      </p>

      {/* Contextual nudge — at most one */}
      {nudge !== null && <StatusLine text={nudge} tone="info" />}
    </main>
  );
}
