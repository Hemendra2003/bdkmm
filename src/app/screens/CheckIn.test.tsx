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

const defaultProps = {
  questions: [q1, q2],
  initialAnswers: null,
  todayKey: '2026-10-02',
  userId: 'user-1',
  onSave: vi.fn<[Answers], Promise<void>>().mockResolvedValue(undefined),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
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

  it('shows all answered in green when complete', () => {
    render(<CheckIn {...defaultProps} />);
    fireEvent.click(screen.getByText('Yes, fully'));
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByText(/2 \/ 2 answered/)).toBeTruthy();
  });

  it('calls onSave and onClose on successful save', async () => {
    render(<CheckIn {...defaultProps} />);
    fireEvent.click(screen.getByText('Yes, fully'));
    fireEvent.click(screen.getByText('Save check-in'));
    await waitFor(() => expect(defaultProps.onSave).toHaveBeenCalledOnce());
    expect(defaultProps.onSave).toHaveBeenCalledWith({ q1: 1 });
    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalledOnce());
  });

  it('shows error and stays open when save fails', async () => {
    const onSave = vi.fn<[Answers], Promise<void>>().mockRejectedValue(new Error('Network error'));
    render(<CheckIn {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save check-in'));
    await waitFor(() => expect(screen.getByText('Network error')).toBeTruthy());
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('loads draft from localStorage', () => {
    localStorage.setItem(
      'md:draft:user-1:2026-10-02',
      JSON.stringify({ q1: 2, q2: 3 }),
    );
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
