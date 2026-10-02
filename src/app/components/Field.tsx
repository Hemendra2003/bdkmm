import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Field({ label, error, id, ...props }: FieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        htmlFor={inputId}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={errorId}
        aria-invalid={error ? 'true' : undefined}
        style={{
          background: 'var(--surface-elevated)',
          border: `1px solid ${error ? 'var(--color-error)' : 'var(--surface-border)'}`,
          borderRadius: 'var(--radius)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-base)',
          lineHeight: 'var(--leading-base)',
          padding: 'var(--space-3) var(--space-4)',
          minHeight: 'var(--touch-min)',
          width: '100%',
          outline: 'none',
          transition: 'border-color var(--duration-fast)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--focus-ring-color)';
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error
            ? 'var(--color-error)'
            : 'var(--surface-border)';
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-error)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
