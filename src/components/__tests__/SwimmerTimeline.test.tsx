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
  collectionGroup: jest.fn((_db: unknown, id: string) => ({ path: id })),
  query: jest.fn((ref: { path: string }) => ({ ...ref, _isQuery: true })),
  where: jest.fn(() => ({ type: 'where' })),
  orderBy: jest.fn(() => ({ type: 'orderBy' })),
  limit: jest.fn(() => ({ type: 'limit' })),
  onSnapshot: jest.fn((_queryRef: unknown, callback: (snap: unknown) => void) => {
    // Immediately call back with empty snapshot
    callback({
      docs: [],
      size: 0,
      empty: true,
    });
    return jest.fn();
  }),
}));

jest.mock('../../utils/time', () => ({
  formatTimeDisplay: jest.fn((h: number) => `${(h / 100).toFixed(2)}`),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import SwimmerTimeline from '../SwimmerTimeline';
const { onSnapshot } = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to empty snapshots
  (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
    cb({ docs: [], size: 0, empty: true });
    return jest.fn();
  });
});

describe('SwimmerTimeline', () => {
  it('shows empty message when no data', () => {
    const { getByText } = render(<SwimmerTimeline swimmerId="s1" />);
    expect(getByText('No timeline entries yet')).toBeTruthy();
  });

  it('renders filter chips', () => {
    const { getByText } = render(<SwimmerTimeline swimmerId="s1" />);
    expect(getByText('ALL')).toBeTruthy();
    expect(getByText('NOTE')).toBeTruthy();
    expect(getByText('PR')).toBeTruthy();
  });

  it('renders note timeline items', () => {
    let callCount = 0;
    (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      callCount++;
      if (callCount === 1) {
        // notes subscription
        cb({
          docs: [
            {
              id: 'n1',
              data: () => ({
                content: 'Great kick improvement',
                practiceDate: '2025-01-15',
                source: 'manual',
                coachName: 'Coach K',
                tags: ['technique'],
              }),
            },
          ],
          size: 1,
          empty: false,
        });
      } else {
        // times subscription
        cb({ docs: [], size: 0, empty: true });
      }
      return jest.fn();
    });

    const { getByText } = render(<SwimmerTimeline swimmerId="s1" />);
    expect(getByText('Great kick improvement')).toBeTruthy();
  });

  it('renders time entries', () => {
    let callCount = 0;
    (onSnapshot as jest.Mock).mockImplementation((_q: unknown, cb: (s: unknown) => void) => {
      callCount++;
      if (callCount === 1) {
        // notes
        cb({ docs: [], size: 0, empty: true });
      } else {
        // times
        cb({
          docs: [
            {
              id: 't1',
              data: () => ({
                event: '100 Free',
                timeDisplay: '58.32',
                meetName: 'Dual Meet',
                meetDate: '2025-01-10',
                isPR: false,
                course: 'SCY',
              }),
            },
          ],
          size: 1,
          empty: false,
        });
      }
      return jest.fn();
    });

    const { getByText } = render(<SwimmerTimeline swimmerId="s1" />);
    expect(getByText(/100 Free/)).toBeTruthy();
  });
});
