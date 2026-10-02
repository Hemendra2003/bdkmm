import type { HistoryEntry } from '../../domain/history.ts';
import { Card } from './Card.tsx';

interface EngineCardProps {
  result: HistoryEntry;
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function fmt(n: number): string {
  return String(Math.round(n));
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--space-2)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          letterSpacing: '.04em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: color ?? 'var(--text-secondary)',
          letterSpacing: '.04em',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ height: 1, background: 'var(--surface-border)', margin: 'var(--space-1) 0' }} />
  );
}

export function EngineCard({ result }: EngineCardProps) {
  const { computed } = result;
  const { status, eligible, partial, answeredCount, dueCount, newVelocity, actualChange } =
    computed;

  // Pending: check-in confirmed but not all questions answered
  if (status === 'pending' || (partial && !eligible)) {
    return (
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-gold)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
            }}
          >
            Score pending
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            {answeredCount} of {dueCount} answered · Complete all questions to score today.
          </p>
        </div>
      </Card>
    );
  }

  // No eligible action score
  if (status === 'no-action') {
    return (
      <Card padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
            }}
          >
            No action score
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            No eligible habits today. Check-in recorded.
          </p>
        </div>
      </Card>
    );
  }

  // Scored
  const { thrust, drag, rawDv, mult, rawChange, shadow, thrustItems, dragItems } = computed;
  const prevVelocity = Math.round(newVelocity - actualChange);
  const changeColor =
    actualChange > 0
      ? 'var(--color-green)'
      : actualChange < 0
        ? 'var(--color-negred)'
        : 'var(--text-muted)';

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-green)',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
            }}
          >
            Scored
          </p>
          <p
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: '9px',
              color: 'var(--color-gold)',
              letterSpacing: '.04em',
            }}
          >
            {fmt(newVelocity)} km/s
          </p>
        </div>

        <Divider />

        {/* Breakdown */}
        <Row label="Previous" value={`${prevVelocity} km/s`} />
        <Row
          label="Thrust"
          value={`+${fmt(thrust)}`}
          color={thrust > 0 ? 'var(--color-green)' : 'var(--text-muted)'}
        />
        {thrustItems.map((item) => (
          <div
            key={item.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingLeft: 'var(--space-4)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              {item.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-green)',
              }}
            >
              +{fmt(item.score)}
            </span>
          </div>
        ))}
        <Row
          label="Drag"
          value={drag > 0 ? `-${fmt(drag)}` : '0'}
          color={drag > 0 ? 'var(--color-negred)' : 'var(--text-muted)'}
        />
        {dragItems.map((item) => (
          <div
            key={item.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingLeft: 'var(--space-4)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              {item.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-negred)',
              }}
            >
              {fmt(item.score)}
            </span>
          </div>
        ))}
        <Row label="Raw" value={`${sign(Math.round(rawDv))} × ${mult}`} />
        <Row label="Adjusted" value={sign(Math.round(rawChange))} />
        {shadow !== 0 && <Row label="Shadow" value={`-${fmt(shadow)}`} color="var(--text-muted)" />}

        <Divider />

        <Row label="Change" value={`${sign(Math.round(actualChange))} km/s`} color={changeColor} />
        <Row label="New momentum" value={`${fmt(newVelocity)} km/s`} color="var(--color-gold)" />
      </div>
    </Card>
  );
}
