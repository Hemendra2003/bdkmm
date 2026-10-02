import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Progress } from './Progress.tsx';
import type { HistoryCache } from '../../domain/history.ts';

const cache: HistoryCache = {
  '2026-09-30': {
    answers: { q1: 3 },
    computed: {
      engineVersion: 'b-1',
      eligible: true,
      partial: false,
      answeredCount: 1,
      excusedCount: 0,
      dueCount: 1,
      status: 'scored',
      answerStates: { q1: 'answered' },
      thrust: 5,
      drag: 0,
      rawDv: 5,
      mult: 1.1,
      rawChange: 6,
      shadow: 0,
      intendedChange: 6,
      actualChange: 6,
      finalDv: 6,
      newVelocity: 106,
      posStreak: 1,
      negStreak: 0,
      thrustItems: [{ name: 'Walk', score: 5 }],
      dragItems: [],
    },
    partial: false,
    answeredCount: 1,
  },
  '2026-10-01': {
    answers: { q1: 1 },
    computed: {
      engineVersion: 'b-1',
      eligible: false,
      partial: true,
      answeredCount: 0,
      excusedCount: 0,
      dueCount: 1,
      status: 'pending',
      answerStates: { q1: 'unanswered' },
      thrust: 0,
      drag: 0,
      rawDv: 0,
      mult: 1,
      rawChange: 0,
      shadow: 0,
      intendedChange: 0,
      actualChange: 0,
      finalDv: 0,
      newVelocity: 106,
      posStreak: 0,
      negStreak: 0,
      thrustItems: [],
      dragItems: [],
    },
    partial: true,
    answeredCount: 0,
  },
};

describe('Progress', () => {
  it('renders with history', () => {
    render(<Progress historyCache={cache} todayKey="2026-10-02" />);
    expect(screen.getByText(/Progress/i)).toBeTruthy();
  });

  it('shows scored and pending entries', () => {
    render(<Progress historyCache={cache} todayKey="2026-10-02" />);
    expect(screen.getAllByText('Scored').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
  });

  it('shows range tabs', () => {
    render(<Progress historyCache={cache} todayKey="2026-10-02" />);
    expect(screen.getByText('Last 7 days')).toBeTruthy();
    expect(screen.getByText('Last 30 days')).toBeTruthy();
    expect(screen.getByText('All time')).toBeTruthy();
  });

  it('switches to All time range', () => {
    render(<Progress historyCache={cache} todayKey="2026-10-02" />);
    fireEvent.click(screen.getByText('All time'));
    expect(screen.getByText(/2 check-ins/)).toBeTruthy();
  });

  it('shows empty state when no history', () => {
    render(<Progress historyCache={{}} todayKey="2026-10-02" />);
    expect(screen.getByText(/No check-ins yet/)).toBeTruthy();
  });

  it('shows velocity for scored entries', () => {
    render(<Progress historyCache={cache} todayKey="2026-10-02" />);
    fireEvent.click(screen.getByText('All time'));
    expect(screen.getByText(/106 km\/s/)).toBeTruthy();
  });
});
