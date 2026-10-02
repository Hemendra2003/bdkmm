import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}
const variantStyle: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-gold)',
    color: 'var(--color-bg-base)',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--color-blue)',
    border: '1px solid rgba(91,191,255,.3)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid transparent',
  },
};

export function Button({
  variant = 'primary',
  fullWidth = false,
  style,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={['momentum-btn', className].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        width: fullWidth ? '100%' : undefined,
        minHeight: 'var(--touch-min)',
        padding: '0 var(--space-4)',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        letterSpacing: '.06em',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.4 : 1,
        transition: 'background var(--duration-fast), opacity var(--duration-fast)',
        ...variantStyle[variant],
        ...style,
      }}
      {...props}
    />
  );
}
