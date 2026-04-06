jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
  })),
  query: jest.fn((ref: { path: string }) => ({ ...ref, _isQuery: true })),
  where: jest.fn(() => ({ type: 'where' })),
  orderBy: jest.fn(() => ({ type: 'orderBy' })),
  limit: jest.fn(() => ({ type: 'limit' })),
  getDocs: jest.fn().mockResolvedValue({ docs: [], size: 0, empty: true }),
  onSnapshot: jest.fn((_queryRef: unknown, callback: (snap: unknown) => void) => {
    callback({ docs: [], size: 0, empty: true });
    return jest.fn();
  }),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import VideoComparison from '../VideoComparison';
const { onSnapshot, getDocs } = require('firebase/firestore');

function makeDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function makeSnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return { docs, size: docs.length, empty: docs.length === 0 };
}

beforeEach(() => {
  jest.clearAllMocks();
  (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
    cb(makeSnapshot([]));
    return jest.fn();
  });
  (getDocs as jest.Mock).mockResolvedValue(makeSnapshot([]));
});

describe('VideoComparison', () => {
  it('renders empty state when no sessions', () => {
    const { getByText } = render(<VideoComparison swimmerId="s1" />);
    expect(getByText('VIDEO COMPARISON')).toBeTruthy();
    expect(getByText(/Need at least 2/)).toBeTruthy();
  });

  it('renders empty state when fewer than 2 sessions', () => {
    (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(
        makeSnapshot([
          makeDoc('vs1', {
            taggedSwimmerIds: ['s1'],
            status: 'posted',
            practiceDate: '2025-01-15',
            createdAt: new Date(),
          }),
        ]),
      );
      return jest.fn();
    });

    const { getByText } = render(<VideoComparison swimmerId="s1" />);
    expect(getByText('VIDEO COMPARISON')).toBeTruthy();
    expect(getByText(/Need at least 2/)).toBeTruthy();
  });

  it('renders comparison panels when 2+ sessions exist', () => {
    (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      cb(
        makeSnapshot([
          makeDoc('vs1', {
            taggedSwimmerIds: ['s1'],
            status: 'posted',
            practiceDate: '2025-01-10',
            createdAt: new Date(),
          }),
          makeDoc('vs2', {
            taggedSwimmerIds: ['s1'],
            status: 'posted',
            practiceDate: '2025-01-20',
            createdAt: new Date(),
          }),
        ]),
      );
      return jest.fn();
    });

    const { getByText } = render(<VideoComparison swimmerId="s1" />);
    expect(getByText('TECHNIQUE PROGRESSION')).toBeTruthy();
    expect(getByText('EARLIER')).toBeTruthy();
    expect(getByText('LATER')).toBeTruthy();
  });
});
