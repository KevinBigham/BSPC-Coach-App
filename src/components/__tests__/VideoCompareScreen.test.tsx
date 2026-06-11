// Phase K: VideoComparison reads through the video service now (FYI-7 — this
// suite's subject IS VideoComparison); the firebase mocks left with the
// subject's re-point.
const mockSubscribeSwimmerVideoSessions = jest.fn();
const mockSubscribeVideoDrafts = jest.fn();

jest.mock('../../services/video', () => ({
  subscribeSwimmerVideoSessions: (...args: Parameters<typeof mockSubscribeSwimmerVideoSessions>) =>
    mockSubscribeSwimmerVideoSessions(...args),
  subscribeVideoDrafts: (...args: Parameters<typeof mockSubscribeVideoDrafts>) =>
    mockSubscribeVideoDrafts(...args),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn(),
}));

import React from 'react';
import { render } from '@testing-library/react-native';

// We test the compare screen indirectly by importing it
// But since it lives in app/, we test the VideoComparison component logic
import VideoComparison from '../VideoComparison';

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
  it('renders empty state when fewer than 2 sessions', () => {
    const { getByText } = render(<VideoComparison swimmerId="sw1" />);
    expect(getByText('VIDEO COMPARISON')).toBeTruthy();
    expect(getByText(/Need at least 2 reviewed video sessions/)).toBeTruthy();
  });
});
