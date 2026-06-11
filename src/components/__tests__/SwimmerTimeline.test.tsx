// Phase K: the timeline's notes/times subscriptions re-pointed onto the PG
// services — the mock moves with them. Subjects preserved 1:1.
const mockSubscribeNotes = jest.fn();
const mockSubscribeTimes = jest.fn();

jest.mock('../../services/notes', () => ({
  subscribeNotes: (...args: Parameters<typeof mockSubscribeNotes>) => mockSubscribeNotes(...args),
}));

jest.mock('../../services/times', () => ({
  subscribeTimes: (...args: Parameters<typeof mockSubscribeTimes>) => mockSubscribeTimes(...args),
}));

jest.mock('../../utils/time', () => ({
  formatTimeDisplay: jest.fn((h: number) => `${(h / 100).toFixed(2)}`),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import SwimmerTimeline from '../SwimmerTimeline';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to empty emissions
  mockSubscribeNotes.mockImplementation((_id: string, cb: (rows: unknown[]) => void) => {
    cb([]);
    return jest.fn();
  });
  mockSubscribeTimes.mockImplementation((_id: string, cb: (rows: unknown[]) => void) => {
    cb([]);
    return jest.fn();
  });
});

describe('SwimmerTimeline', () => {
  it('shows empty message when no data', () => {
    const { getByText } = render(<SwimmerTimeline swimmerId="s1" />);
    expect(getByText('No timeline entries yet')).toBeTruthy();
    expect(mockSubscribeNotes).toHaveBeenCalledWith('s1', expect.any(Function), 100);
    expect(mockSubscribeTimes).toHaveBeenCalledWith('s1', expect.any(Function), 100);
  });

  it('renders filter chips', () => {
    const { getByText } = render(<SwimmerTimeline swimmerId="s1" />);
    expect(getByText('ALL')).toBeTruthy();
    expect(getByText('NOTE')).toBeTruthy();
    expect(getByText('PR')).toBeTruthy();
  });

  it('renders note timeline items', () => {
    mockSubscribeNotes.mockImplementation((_id: string, cb: (rows: unknown[]) => void) => {
      cb([
        {
          id: 'n1',
          content: 'Great kick improvement',
          practiceDate: '2025-01-15',
          source: 'manual',
          coachName: 'Coach K',
          tags: ['technique'],
        },
      ]);
      return jest.fn();
    });

    const { getByText } = render(<SwimmerTimeline swimmerId="s1" />);
    expect(getByText('Great kick improvement')).toBeTruthy();
  });

  it('renders time entries', () => {
    mockSubscribeTimes.mockImplementation((_id: string, cb: (rows: unknown[]) => void) => {
      cb([
        {
          id: 't1',
          event: '100 Free',
          timeDisplay: '58.32',
          meetName: 'Dual Meet',
          meetDate: '2025-01-10',
          isPR: false,
          course: 'SCY',
        },
      ]);
      return jest.fn();
    });

    const { getByText } = render(<SwimmerTimeline swimmerId="s1" />);
    expect(getByText(/100 Free/)).toBeTruthy();
  });
});
