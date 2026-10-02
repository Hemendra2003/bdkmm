interface StatusLineProps {
  text: string;
  tone?: 'error' | 'warning' | 'info' | 'muted';
}

const toneColor: Record<NonNullable<StatusLineProps['tone']>, string> = {
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
  muted: 'var(--text-muted)',
};

export function StatusLine({ text, tone = 'muted' }: StatusLineProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        letterSpacing: '.06em',
        lineHeight: 'var(--leading-xs)',
        textAlign: 'center',
        color: toneColor[tone],
        minHeight: 0,
        padding: text ? 'var(--space-1) 0' : undefined,
      }}
    >
      {text}
    </p>
  );
}
