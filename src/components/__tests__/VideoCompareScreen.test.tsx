jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('../../stores/swimmersStore', () => ({
  useSwimmersStore: jest.fn((selector: (s: any) => any) =>
    selector({
      swimmers: [
        { id: 'sw1', displayName: 'Alice' },
        { id: 'sw2', displayName: 'Bob' },
      ],
    }),
  ),
}));

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn(),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// We test the compare screen indirectly by importing it
// But since it lives in app/, we test the VideoComparison component logic
import VideoComparison from '../VideoComparison';

describe('VideoComparison', () => {
  it('renders empty state when fewer than 2 sessions', () => {
    const { getByText } = render(<VideoComparison swimmerId="sw1" />);
    expect(getByText('VIDEO COMPARISON')).toBeTruthy();
    expect(getByText(/Need at least 2 reviewed video sessions/)).toBeTruthy();
  });
});
