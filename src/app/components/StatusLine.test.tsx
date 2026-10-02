import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusLine } from './StatusLine.tsx';

describe('StatusLine', () => {
  it('renders with role=status and aria-live=polite', () => {
    render(<StatusLine text="Saving…" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders the text content', () => {
    render(<StatusLine text="Not saved — try again" tone="error" />);
    expect(screen.getByRole('status')).toHaveTextContent('Not saved — try again');
  });

  it('uses error color for tone=error', () => {
    render(<StatusLine text="Oops" tone="error" />);
    expect(screen.getByRole('status').style.color).toBe('var(--color-error)');
  });
});
