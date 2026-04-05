let mockNetInfoCallback: ((state: { isConnected: boolean }) => void) | null = null;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((cb: (state: { isConnected: boolean }) => void) => {
      mockNetInfoCallback = cb;
      return () => {
        mockNetInfoCallback = null;
      };
    }),
  },
}));

import React from 'react';
import { render, act } from '@testing-library/react-native';
import OfflineIndicator from '../OfflineIndicator';

describe('OfflineIndicator', () => {
  beforeEach(() => {
    mockNetInfoCallback = null;
  });

  it('renders nothing when online', () => {
    const { queryByText } = render(<OfflineIndicator />);
    // Simulate online
    act(() => {
      mockNetInfoCallback?.({ isConnected: true });
    });
    expect(queryByText('OFFLINE MODE')).toBeNull();
  });

  it('renders offline banner when disconnected', () => {
    const { queryByText } = render(<OfflineIndicator />);
    act(() => {
      mockNetInfoCallback?.({ isConnected: false });
    });
    expect(queryByText('OFFLINE MODE')).toBeTruthy();
  });

  it('hides banner when reconnected', () => {
    const { queryByText } = render(<OfflineIndicator />);
    act(() => {
      mockNetInfoCallback?.({ isConnected: false });
    });
    expect(queryByText('OFFLINE MODE')).toBeTruthy();

    act(() => {
      mockNetInfoCallback?.({ isConnected: true });
    });
    expect(queryByText('OFFLINE MODE')).toBeNull();
  });
});
