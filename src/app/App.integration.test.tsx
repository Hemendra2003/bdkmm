import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getState, getDayScore } from './store.ts';
import type { EngineResult } from '../domain/scoring.ts';
import type { AppState } from './store.ts';
vi.mock('./store.ts', () => ({
  getState: vi.fn(),
  getDayScore: vi.fn(),
  subscribe: () => () => {},
  signOut: vi.fn(),
  finishRecovery: vi.fn(),
  signIn: vi.fn(),
  saveCheckIn: vi.fn(),
  saveQuestion: vi.fn(),
  removeQuestion: vi.fn(),
}));
import { App } from './App.tsx';
const state: AppState = {
  status: 'signed-in',
  userId: 'A',
  todayKey: '2026-10-02',
  questions: [
    {
      id: 1,
      is_fixed: false,
      key: 'move',
      text: 'Move',
      opts: ['Low', 'Mid', 'High'],
      polarity: 'positive',
      tier: 'S',
      sort_order: 0,
      source: 'custom',
    },
  ],
  todayEntry: { date: '2026-10-02', answers: {}, updated_at: null },
  loadError: null,
  lastScored: null,
  weekCheckIns: 1,
  entries: [],
  history: {},
  savingDate: null,
  recoveryMode: false,
  recoveryReady: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/app/#today');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(getState).mockReturnValue(state);
  vi.mocked(getDayScore).mockReturnValue({
    date: '2026-10-02',
    state: 'pending',
    checkInStatus: 'partial',
    result: {} as EngineResult,
  });
});
it('Today uses replay status for Continue and labels its rolling window', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: 'Continue check-in' })).toBeVisible();
  expect(screen.getByText('Check-in saved · Score pending')).toBeVisible();
  expect(screen.getByText(/Last 7 days:/)).toBeVisible();
  expect(screen.queryByText(/This week:/)).not.toBeInTheDocument();
});
it('navigation updates title, resets scroll and focuses the destination heading', async () => {
  render(<App />);
  const content = document.querySelector<HTMLElement>('[data-route-content]')!;
  content.scrollTop = 150;
  fireEvent.click(screen.getByRole('button', { name: 'Habits' }));
  await waitFor(() => expect(document.title).toBe('Habits · MOMENTUM'));
  expect(content.scrollTop).toBe(0);
  expect(screen.getByRole('heading', { name: 'Habits' })).toHaveFocus();
  expect(window.scrollTo).toHaveBeenCalled();
});
it('hashchange and Back-style navigation have the same heading/title behavior', async () => {
  render(<App />);
  window.history.replaceState(null, '', '/app/#progress');
  fireEvent(window, new HashChangeEvent('hashchange'));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Progress' })).toHaveFocus());
  expect(document.title).toBe('Progress · MOMENTUM');
  window.history.replaceState(null, '', '/app/#today');
  fireEvent(window, new HashChangeEvent('hashchange'));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Today' })).toHaveFocus());
  expect(document.title).toBe('Today · MOMENTUM');
});

it('recovery mode takes priority over loading and normal navigation', () => {
  vi.mocked(getState).mockReturnValue({
    ...state,
    status: 'loading',
    userId: null,
    recoveryMode: true,
  });
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  expect(screen.getByText('Checking your recovery link…')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  expect(document.title).toBe('Reset password · MOMENTUM');
});
it('an empty routine opens optional setup and skip returns to Today even without storage', () => {
  vi.mocked(getState).mockReturnValue({ ...state, questions: [] });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Unavailable');
  });
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Choose your routine' })).toBeVisible();
  expect(document.title).toBe('Choose routine · MOMENTUM');
  fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
  expect(screen.getByRole('heading', { name: 'Today' })).toBeVisible();
  expect(document.title).toBe('Today · MOMENTUM');
});
