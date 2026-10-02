import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AppState } from '../store.ts';
const m = vi.hoisted(() => ({
  send: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  skip: vi.fn(),
  signIn: vi.fn(),
  context: { userId: 'A', generation: 1 },
}));
vi.mock('../auth/api.ts', () => ({
  sendAuthEmail: m.send,
  emailCooldown: () => 0,
  signInWithGoogle: vi.fn(),
  updateRecoveryPassword: m.update,
}));
vi.mock('../store.ts', () => ({
  signIn: m.signIn,
  finishRecovery: vi.fn(),
  getState: () => ({ userId: 'A' }),
  getAuthContext: () => ({ ...m.context }),
  isAuthContextCurrent: (c: typeof m.context) =>
    c.userId === m.context.userId && c.generation === m.context.generation,
}));
vi.mock('../auth/setup.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/setup.ts')>()),
  saveStarterPreset: m.save,
  skipSetup: m.skip,
}));
import { SignIn } from './SignIn.tsx';
import { ResetPassword } from './ResetPassword.tsx';
import { Setup } from './Setup.tsx';
beforeEach(() => {
  vi.clearAllMocks();
  m.send.mockResolvedValue(undefined);
  m.update.mockResolvedValue(undefined);
  m.save.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
it('forgot password sends a recovery email with neutral success copy and preserves email', async () => {
  render(<SignIn />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.test' } });
  fireEvent.click(screen.getByText('Forgot password?'));
  fireEvent.click(screen.getByRole('button', { name: 'Send recovery link' }));
  expect(await screen.findByText(/If an account exists/)).toBeVisible();
  expect(m.send).toHaveBeenCalledWith('a@example.test', 'recovery');
  expect(screen.getByLabelText('Email')).toHaveValue('a@example.test');
});
it('recovery rejects mismatched passwords and announces success only after SDK acceptance', async () => {
  const state = { userId: 'A', recoveryReady: true, status: 'signed-in' } as AppState;
  render(<ResetPassword state={state} />);
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'longpassword' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'otherpassword' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(await screen.findByText('Passwords must match.')).toBeVisible();
  expect(m.update).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'longpassword' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  expect(await screen.findByText('Your password has been updated.')).toBeVisible();
  expect(m.update).toHaveBeenCalledWith('longpassword');
});
it('expired link offers a new request instead of an enabled password form', () => {
  render(<ResetPassword state={{ recoveryReady: false, status: 'signed-out' } as AppState} />);
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Request a new link'));
  expect(screen.getByRole('button', { name: 'Send recovery link' })).toBeVisible();
});
it('starter preset is optional, editable and not silently written', async () => {
  const complete = vi.fn();
  render(<Setup onComplete={complete} />);
  expect(m.save).not.toHaveBeenCalled();
  expect(screen.getAllByRole('group')).toHaveLength(4);
  fireEvent.change(screen.getByLabelText('Habit 1 name'), { target: { value: 'My movement' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this routine' }));
  await waitFor(() => expect(m.save).toHaveBeenCalled());
  expect(m.save.mock.calls[0][0][0].text).toBe('My movement');
  expect(await screen.findByText('Your routine is saved.')).toBeVisible();
  expect(complete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Start your first check-in'));
  expect(complete).toHaveBeenCalledWith(true);
});
it('skip never writes questions and failure does not show success', async () => {
  const complete = vi.fn();
  render(<Setup onComplete={complete} />);
  fireEvent.click(screen.getByText('Skip for now'));
  expect(m.skip).toHaveBeenCalledWith('A');
  expect(m.save).not.toHaveBeenCalled();
  expect(complete).toHaveBeenCalledWith(false);
  m.save.mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Use this routine' }));
  expect(await screen.findByText(/routine could not be saved/)).toBeVisible();
  expect(screen.queryByText('Your routine is saved.')).not.toBeInTheDocument();
});
