import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field.tsx';

describe('Field', () => {
  it('renders a label and input', () => {
    render(<Field label="Email" id="email" />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('marks input invalid and shows error when error prop is set', () => {
    render(<Field label="Email" id="email" error="Required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('links input to its error via aria-describedby', () => {
    render(<Field label="Email" id="email" error="Bad format" />);
    const input = screen.getByLabelText('Email');
    const errorId = input.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    const errorEl = document.getElementById(errorId!);
    expect(errorEl?.textContent).toBe('Bad format');
  });

  it('has no error markup when error is absent', () => {
    render(<Field label="Email" id="email" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
