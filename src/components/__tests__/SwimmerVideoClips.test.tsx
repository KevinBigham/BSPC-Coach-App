// Phase K: the tagged-swimmer sessions query re-pointed onto the
// junction-filtered service read — the mock moves with it. Subjects
// preserved 1:1.
const mockSubscribeSwimmerVideoSessions = jest.fn();

jest.mock('../../services/video', () => ({
  subscribeSwimmerVideoSessions: (...args: Parameters<typeof mockSubscribeSwimmerVideoSessions>) =>
    mockSubscribeSwimmerVideoSessions(...args),
  getVideoStatusLabel: (status: string) => {
    const map: Record<string, string> = {
      uploading: 'UPLOADING',
      uploaded: 'UPLOADED',
      review: 'READY FOR REVIEW',
      posted: 'POSTED',
      failed: 'FAILED',
    };
    return map[status] || status;
  },
  getVideoStatusColor: (status: string) => {
    const map: Record<string, string> = {
      posted: '#CCB000',
      review: '#FFD700',
      failed: '#f43f5e',
    };
    return map[status] || '#7a7a8e';
  },
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import SwimmerVideoClips from '../SwimmerVideoClips';

beforeEach(() => {
  jest.clearAllMocks();
  mockSubscribeSwimmerVideoSessions.mockImplementation(
    (_id: string, cb: (rows: unknown[]) => void) => {
      cb([]);
      return jest.fn();
    },
  );
});

function makeSession(id: string, data: Record<string, unknown>) {
  return { id, taggedSwimmerIds: ['s1'], selectedSwimmerIds: [], ...data };
}

describe('SwimmerVideoClips', () => {
  it('renders nothing when no sessions', () => {
    const { toJSON } = render(<SwimmerVideoClips swimmerId="s1" />);
    expect(toJSON()).toBeNull();
    expect(mockSubscribeSwimmerVideoSessions).toHaveBeenCalledWith('s1', expect.any(Function));
  });

  it('renders video session cards', () => {
    mockSubscribeSwimmerVideoSessions.mockImplementation(
      (_id: string, cb: (rows: unknown[]) => void) => {
        cb([
          makeSession('vs1', {
            status: 'posted',
            duration: 30,
            practiceDate: '2025-01-15',
            createdAt: new Date(),
          }),
          makeSession('vs2', {
            status: 'review',
            duration: 45,
            practiceDate: '2025-01-20',
            createdAt: new Date(),
          }),
        ]);
        return jest.fn();
      },
    );

    const { getByText } = render(<SwimmerVideoClips swimmerId="s1" />);
    expect(getByText('VIDEO CLIPS (2)')).toBeTruthy();
  });

  it('renders status badges', () => {
    mockSubscribeSwimmerVideoSessions.mockImplementation(
      (_id: string, cb: (rows: unknown[]) => void) => {
        cb([
          makeSession('vs1', {
            status: 'posted',
            duration: 30,
            practiceDate: '2025-01-15',
            createdAt: new Date(),
          }),
        ]);
        return jest.fn();
      },
    );

    const { getByText } = render(<SwimmerVideoClips swimmerId="s1" />);
    expect(getByText('POSTED')).toBeTruthy();
  });

  it('navigates to video detail on press', () => {
    mockSubscribeSwimmerVideoSessions.mockImplementation(
      (_id: string, cb: (rows: unknown[]) => void) => {
        cb([
          makeSession('vs1', {
            status: 'posted',
            duration: 30,
            practiceDate: '2025-01-15',
            createdAt: new Date(),
          }),
        ]);
        return jest.fn();
      },
    );

    const { getByText } = render(<SwimmerVideoClips swimmerId="s1" />);
    fireEvent.press(getByText('2025-01-15'));
    expect(router.push).toHaveBeenCalledWith('/video/vs1');
  });
});
