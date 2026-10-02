import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Habits } from './Habits.tsx';
import type { QuestionRow, QuestionInput } from '../../data/repositories.ts';

const q1: QuestionRow = {
  id: '1',
  key: 'daily-walk',
  text: 'Did you go for a walk?',
  opts: ['No', 'Partially', 'Yes, fully'],
  polarity: 'positive',
  tier: 'A',
  is_fixed: false,
  source: 'custom',
  sort_order: 1,
};

function makeSave() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn((_: QuestionInput): Promise<void> => Promise.resolve());
}
function makeRemove() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn((_: string): Promise<void> => Promise.resolve());
}

beforeEach(() => vi.clearAllMocks());

describe('Habits', () => {
  it('shows empty state when no habits', () => {
    render(<Habits questions={[]} onSave={makeSave()} onRemove={makeRemove()} />);
    expect(screen.getByText(/No habits yet/)).toBeTruthy();
  });

  it('lists habit name and options', () => {
    render(<Habits questions={[q1]} onSave={makeSave()} onRemove={makeRemove()} />);
    expect(screen.getByText('Did you go for a walk?')).toBeTruthy();
    expect(screen.getByText(/No · Partially · Yes, fully/)).toBeTruthy();
  });

  it('shows Add habit button', () => {
    render(<Habits questions={[]} onSave={makeSave()} onRemove={makeRemove()} />);
    expect(screen.getByText('+ Add habit')).toBeTruthy();
  });

  it('opens new habit form on Add habit click', () => {
    render(<Habits questions={[]} onSave={makeSave()} onRemove={makeRemove()} />);
    fireEvent.click(screen.getByText('+ Add habit'));
    expect(screen.getByText('New habit')).toBeTruthy();
    expect(screen.getByLabelText('Habit name')).toBeTruthy();
  });

  it('validates required fields', async () => {
    render(<Habits questions={[]} onSave={makeSave()} onRemove={makeRemove()} />);
    fireEvent.click(screen.getByText('+ Add habit'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.getByText('Habit name is required.')).toBeTruthy());
  });

  it('opens edit form when habit clicked', () => {
    render(<Habits questions={[q1]} onSave={makeSave()} onRemove={makeRemove()} />);
    fireEvent.click(screen.getByText('Did you go for a walk?'));
    expect(screen.getByText('Edit habit')).toBeTruthy();
  });

  it('calls onSave with correct data when saving new habit', async () => {
    const onSave = makeSave();
    render(<Habits questions={[]} onSave={onSave} onRemove={makeRemove()} />);
    fireEvent.click(screen.getByText('+ Add habit'));
    fireEvent.change(screen.getByLabelText('Habit name'), {
      target: { value: 'My habit' },
    });
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'No' } });
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'Somewhat' } });
    fireEvent.change(screen.getByLabelText('Option 3'), { target: { value: 'Yes' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const call = onSave.mock.calls[0][0] as QuestionInput;
    expect(call.text).toBe('My habit');
    expect(call.opts).toEqual(['No', 'Somewhat', 'Yes']);
    expect(call.polarity).toBe('positive');
    expect(call.tier).toBe('A');
  });
});
