// Phase K: the posted-only tagged-swimmer sessions query + the drafts
// subcollection reads re-pointed onto the service — the mock moves with
// them. Subjects preserved 1:1.
const mockSubscribeSwimmerVideoSessions = jest.fn();
const mockSubscribeVideoDrafts = jest.fn();

jest.mock('../../services/video', () => ({
  subscribeSwimmerVideoSessions: (...args: Parameters<typeof mockSubscribeSwimmerVideoSessions>) =>
    mockSubscribeSwimmerVideoSessions(...args),
  subscribeVideoDrafts: (...args: Parameters<typeof mockSubscribeVideoDrafts>) =>
    mockSubscribeVideoDrafts(...args),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import VideoComparison from '../VideoComparison';

function makeSession(id: string, data: Record<string, unknown>) {
  return { id, taggedSwimmerIds: ['s1'], selectedSwimmerIds: [], ...data };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSubscribeSwimmerVideoSessions.mockImplementation(
    (_id: string, cb: (rows: unknown[]) => void) => {
      cb([]);
      return jest.fn();
    },
  );
  mockSubscribeVideoDrafts.mockImplementation((_id: string, cb: (rows: unknown[]) => void) => {
    cb([]);
    return jest.fn();
  });
});

describe('VideoComparison', () => {
  it('renders empty state when no sessions', () => {
    const { getByText } = render(<VideoComparison swimmerId="s1" />);
    expect(getByText('VIDEO COMPARISON')).toBeTruthy();
    expect(getByText(/Need at least 2/)).toBeTruthy();
    expect(mockSubscribeSwimmerVideoSessions).toHaveBeenCalledWith('s1', expect.any(Function), {
      postedOnly: true,
    });
  });

  it('renders empty state when fewer than 2 sessions', () => {
    mockSubscribeSwimmerVideoSessions.mockImplementation(
      (_id: string, cb: (rows: unknown[]) => void) => {
        cb([
          makeSession('vs1', {
            status: 'posted',
            practiceDate: '2025-01-15',
            createdAt: new Date(),
          }),
        ]);
        return jest.fn();
      },
    );

    const { getByText } = render(<VideoComparison swimmerId="s1" />);
    expect(getByText('VIDEO COMPARISON')).toBeTruthy();
    expect(getByText(/Need at least 2/)).toBeTruthy();
  });

  it('renders comparison panels when 2+ sessions exist', () => {
    mockSubscribeSwimmerVideoSessions.mockImplementation(
      (_id: string, cb: (rows: unknown[]) => void) => {
        cb([
          makeSession('vs1', {
            status: 'posted',
            practiceDate: '2025-01-10',
            createdAt: new Date(),
          }),
          makeSession('vs2', {
            status: 'posted',
            practiceDate: '2025-01-20',
            createdAt: new Date(),
          }),
        ]);
        return jest.fn();
      },
    );

    const { getByText } = render(<VideoComparison swimmerId="s1" />);
    expect(getByText('TECHNIQUE PROGRESSION')).toBeTruthy();
    expect(getByText('EARLIER')).toBeTruthy();
    expect(getByText('LATER')).toBeTruthy();
  });
});
