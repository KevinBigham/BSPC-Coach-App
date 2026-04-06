jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('../../services/video', () => ({
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

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  query: jest.fn((ref: { path: string }) => ({ ...ref, _isQuery: true })),
  where: jest.fn(() => ({ type: 'where' })),
  orderBy: jest.fn(() => ({ type: 'orderBy' })),
  limit: jest.fn(() => ({ type: 'limit' })),
  onSnapshot: jest.fn((_queryRef: unknown, callback: (snap: unknown) => void) => {
    callback({ docs: [], size: 0, empty: true });
    return jest.fn();
  }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import SwimmerVideoClips from '../SwimmerVideoClips';
const { onSnapshot } = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
  (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
    cb({ docs: [], size: 0, empty: true });
    return jest.fn();
  });
});

function makeDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe('SwimmerVideoClips', () => {
  it('renders nothing when no sessions', () => {
    const { toJSON } = render(<SwimmerVideoClips swimmerId="s1" />);
    expect(toJSON()).toBeNull();
  });

  it('renders video session cards', () => {
    (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb({
        docs: [
          makeDoc('vs1', {
            taggedSwimmerIds: ['s1'],
            status: 'posted',
            duration: 30,
            practiceDate: '2025-01-15',
            createdAt: new Date(),
          }),
          makeDoc('vs2', {
            taggedSwimmerIds: ['s1'],
            status: 'review',
            duration: 45,
            practiceDate: '2025-01-20',
            createdAt: new Date(),
          }),
        ],
        size: 2,
        empty: false,
      });
      return jest.fn();
    });

    const { getByText } = render(<SwimmerVideoClips swimmerId="s1" />);
    expect(getByText('VIDEO CLIPS (2)')).toBeTruthy();
  });

  it('renders status badges', () => {
    (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb({
        docs: [
          makeDoc('vs1', {
            taggedSwimmerIds: ['s1'],
            status: 'posted',
            duration: 30,
            practiceDate: '2025-01-15',
            createdAt: new Date(),
          }),
        ],
        size: 1,
        empty: false,
      });
      return jest.fn();
    });

    const { getByText } = render(<SwimmerVideoClips swimmerId="s1" />);
    expect(getByText('POSTED')).toBeTruthy();
  });

  it('navigates to video detail on press', () => {
    (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb({
        docs: [
          makeDoc('vs1', {
            taggedSwimmerIds: ['s1'],
            status: 'posted',
            duration: 30,
            practiceDate: '2025-01-15',
            createdAt: new Date(),
          }),
        ],
        size: 1,
        empty: false,
      });
      return jest.fn();
    });

    const { getByText } = render(<SwimmerVideoClips swimmerId="s1" />);
    fireEvent.press(getByText('2025-01-15'));
    expect(router.push).toHaveBeenCalledWith('/video/vs1');
  });
});
