import { useState } from 'react';
import type { HistoryCache } from '../../domain/history.ts';
import { Card } from '../components/Card.tsx';

interface ProgressProps {
  historyCache: HistoryCache;
  todayKey: string | null;
}

type Range = '7d' | '30d' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function formatDate(key: string): string {
  try {
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(year, month - 1, day));
  } catch {
    return key;
  }
}

function formatMonth(key: string): string {
  try {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    );
  } catch {
    return key.slice(0, 7);
  }
}

type EntryStatus = 'scored' | 'pending' | 'no-action';

interface HistoryRow {
  date: string;
  status: EntryStatus;
  velocity: number | null;
  actualChange: number | null;
}

function statusLabel(s: EntryStatus): string {
  if (s === 'scored') return 'Scored';
  if (s === 'pending') return 'Pending';
  return 'No score';
}

function statusColor(s: EntryStatus): string {
  if (s === 'scored') return 'var(--color-green)';
  if (s === 'pending') return 'var(--color-gold)';
  return 'var(--text-muted)';
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function filterByRange(rows: HistoryRow[], range: Range, todayKey: string): HistoryRow[] {
  if (range === 'all') return rows;
  const days = range === '7d' ? 6 : 29;
  const start = addDays(todayKey, -days);
  return rows.filter((r) => r.date >= start && r.date <= todayKey);
}

function groupByMonth(rows: HistoryRow[]): Map<string, HistoryRow[]> {
  const map = new Map<string, HistoryRow[]>();
  for (const row of rows) {
    const monthKey = row.date.slice(0, 7);
    const group = map.get(monthKey) ?? [];
    group.push(row);
    map.set(monthKey, group);
  }
  return map;
}

export function Progress({ historyCache, todayKey }: ProgressProps) {
  const [range, setRange] = useState<Range>('30d');

  const allRows: HistoryRow[] = Object.entries(historyCache)
    .map(([date, entry]) => {
      const { status, newVelocity, actualChange } = entry.computed;
      const entryStatus: EntryStatus =
        status === 'scored' ? 'scored' : status === 'pending' ? 'pending' : 'no-action';
      return {
        date,
        status: entryStatus,
        velocity: entryStatus === 'scored' ? Math.round(newVelocity) : null,
        actualChange: entryStatus === 'scored' ? Math.round(actualChange) : null,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const filtered = todayKey ? filterByRange(allRows, range, todayKey) : allRows;
  const grouped = groupByMonth(filtered);
  const monthKeys = [...grouped.keys()].sort().reverse();

  const scoredCount = filtered.filter((r) => r.status === 'scored').length;
  const totalCount = filtered.length;

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
      <h1
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        Progress
      </h1>

      {/* Range tabs */}
      <div
        role="tablist"
        aria-label="History range"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--surface-border)',
          paddingBottom: 'var(--space-2)',
        }}
      >
        {(['7d', '30d', 'all'] as Range[]).map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={range === r}
            onClick={() => setRange(r)}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              letterSpacing: '.04em',
              color: range === r ? 'var(--color-gold)' : 'var(--text-muted)',
              borderBottom: range === r ? '2px solid var(--color-gold)' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Summary */}
      {totalCount > 0 && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            letterSpacing: '.04em',
          }}
        >
          {scoredCount} scored · {totalCount} check-in{totalCount !== 1 ? 's' : ''}
        </p>
      )}

      {/* Empty state */}
      {totalCount === 0 && (
        <Card padding="lg" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {allRows.length === 0
              ? 'No check-ins yet. Start your first check-in on the Today tab.'
              : 'No check-ins in this period.'}
          </p>
        </Card>
      )}

      {/* Date-grouped history list */}
      {monthKeys.map((monthKey) => {
        const rows = grouped.get(monthKey) ?? [];
        return (
          <div
            key={monthKey}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              {formatMonth(monthKey)}
            </p>
            <Card padding="sm" style={{ overflow: 'hidden', padding: 0 }}>
              {rows.map((row, idx) => (
                <div
                  key={row.date}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom:
                      idx < rows.length - 1 ? '1px solid var(--surface-border)' : 'none',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {formatDate(row.date)}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      flexShrink: 0,
                    }}
                  >
                    {row.status === 'scored' && row.actualChange !== null && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color:
                            row.actualChange > 0
                              ? 'var(--color-green)'
                              : row.actualChange < 0
                                ? 'var(--color-negred)'
                                : 'var(--text-muted)',
                        }}
                      >
                        {sign(row.actualChange)} km/s
                      </span>
                    )}
                    {row.status === 'scored' && row.velocity !== null && (
                      <span
                        style={{
                          fontFamily: 'var(--font-pixel)',
                          fontSize: '8px',
                          color: 'var(--color-gold)',
                          letterSpacing: '.04em',
                        }}
                      >
                        {row.velocity} km/s
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: statusColor(row.status),
                        border: `1px solid ${statusColor(row.status)}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '1px 5px',
                        opacity: 0.85,
                      }}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        );
      })}
    </main>
  );
}
