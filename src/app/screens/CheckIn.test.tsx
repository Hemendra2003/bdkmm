import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CheckIn } from './CheckIn.tsx';
import type { QuestionRow, Answers } from '../../data/repositories.ts';

const q1: QuestionRow = {
  id: '1',
  key: 'q1',
  text: 'Did you exercise today?',
  opts: ['Yes, fully', 'Partially', 'No'],
  polarity: 'positive',
  tier: 'A',
  is_fixed: false,
  source: 'custom',
  sort_order: 1,
};

const q2: QuestionRow = {
  id: '2',
  key: 'q2',
  text: 'Did you eat well?',
  opts: ['Yes', 'Somewhat', 'No'],
  polarity: 'positive',
  tier: 'B',
  is_fixed: false,
  source: 'custom',
  sort_order: 2,
};

function makeSave(result: 'resolve' | 'reject' = 'resolve') {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fn = vi.fn((_: Answers): Promise<void> => {
    if (result === 'reject') return Promise.reject(new Error('Network error'));
    return Promise.resolve();
  });
  return fn;
}

const defaultProps = {
  questions: [q1, q2],
  initialAnswers: null as Answers | null,
  todayKey: '2026-10-02',
  userId: 'user-1',
  onSave: makeSave(),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  defaultProps.onSave = makeSave();
  defaultProps.onClose = vi.fn();
});

describe('CheckIn', () => {
  it('renders questions with all options', () => {
    render(<CheckIn {...defaultProps} />);
    expect(screen.getByText('Did you exercise today?')).toBeTruthy();
    expect(screen.getByText('Yes, fully')).toBeTruthy();
    expect(screen.getByText('Partially')).toBeTruthy();
    expect(screen.getAllByText('No').length).toBeGreaterThanOrEqual(1);
  });

  it('shows progress counter', () => {
    render(<CheckIn {...defaultProps} />);
    expect(screen.getByText(/0 \/ 2 answered/)).toBeTruthy();
  });

  it('updates progress when option selected', () => {
    render(<CheckIn {...defaultProps} />);
    fireEvent.click(screen.getByText('Yes, fully'));
    expect(screen.getByText(/1 \/ 2 answered/)).toBeTruthy();
  });

  it('shows partial-score notice when some answered', () => {
    render(<CheckIn {...defaultProps} />);
    fireEvent.click(screen.getByText('Yes, fully'));
    expect(screen.getByText(/1 unanswered · Score will remain pending/)).toBeTruthy();
  });

  it('shows all answered when complete', () => {
    render(<CheckIn {...defaultProps} />);
    fireEvent.click(screen.getByText('Yes, fully'));
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByText(/2 \/ 2 answered/)).toBeTruthy();
  });

  it('calls onSave and onClose on successful save', async () => {
    const onSave = makeSave('resolve');
    const onClose = vi.fn();
    render(<CheckIn {...defaultProps} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByText('Yes, fully'));
    fireEvent.click(screen.getByText('Save check-in'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({ q1: 1 });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('shows error and stays open when save fails', async () => {
    const onSave = makeSave('reject');
    const onClose = vi.fn();
    render(<CheckIn {...defaultProps} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByText('Save check-in'));
    await waitFor(() => expect(screen.getByText('Network error')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('loads draft from localStorage', () => {
    localStorage.setItem('md:draft:user-1:2026-10-02', JSON.stringify({ q1: 2, q2: 3 }));
    render(<CheckIn {...defaultProps} />);
    expect(screen.getByText(/2 \/ 2 answered/)).toBeTruthy();
  });

  it('shows empty state when no questions', () => {
    render(<CheckIn {...defaultProps} questions={[]} />);
    expect(screen.getByText(/No habits set up yet/)).toBeTruthy();
  });

  it('skip button appears after answering and clears answer', async () => {
    render(<CheckIn {...defaultProps} />);
    fireEvent.click(screen.getByText('Yes, fully'));
    const skipBtn = screen.getByText('Skip for now');
    expect(skipBtn).toBeTruthy();
    fireEvent.click(skipBtn);
    expect(screen.getByText(/0 \/ 2 answered/)).toBeTruthy();
  });
});

it('keeps check-in radios natively focusable with a visible-label focus hook', () => {
  render(<CheckIn {...defaultProps} />);
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(6);
  for (const radio of radios) {
    expect(radio).toBeEnabled();
    expect(radio.tabIndex).toBe(0);
    expect(radio.closest('label')).toHaveClass('radio-option');
    radio.focus();
    expect(radio).toHaveFocus();
  }
  fireEvent.click(radios[1]);
  expect(radios[1]).toBeChecked();
  expect(radios[0]).not.toBeChecked();
});
