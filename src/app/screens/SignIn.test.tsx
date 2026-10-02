import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../store.ts', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getState: vi.fn(() => ({
    status: 'signed-out',
    userId: null,
    todayKey: null,
    questions: [],
    todayEntry: null,
    loadError: null,
  })),
  subscribe: vi.fn(() => () => {}),
}));

import { SignIn } from './SignIn.tsx';
import { signIn } from '../store.ts';

describe('SignIn error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the error string returned by signIn', async () => {
    vi.mocked(signIn).mockResolvedValue('Invalid login credentials');
    render(<SignIn />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Invalid login credentials');
  });

  it('shows a connection error when signIn throws', async () => {
    vi.mocked(signIn).mockRejectedValue(new Error('Network failure'));
    render(<SignIn />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/connection|failed|try again/i);
  });
});
