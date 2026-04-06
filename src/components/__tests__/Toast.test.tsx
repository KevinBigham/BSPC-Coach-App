jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: React.ComponentType) => Component,
      addWhitelistedNativeProps: jest.fn(),
      addWhitelistedUIProps: jest.fn(),
      call: jest.fn(),
      View,
    },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withTiming: (val: unknown) => val,
    withDelay: (_d: number, val: unknown) => val,
    withSpring: (val: unknown) => val,
    runOnJS: (fn: (...args: unknown[]) => void) => fn,
    Easing: { linear: jest.fn(), ease: jest.fn() },
  };
});

import React from 'react';
import { render } from '@testing-library/react-native';
import Toast from '../Toast';

const defaultProps = () => ({
  message: 'Test message',
  type: 'success' as const,
  visible: true,
  onDismiss: jest.fn(),
});

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders message text', () => {
    const { getByText } = render(<Toast {...defaultProps()} />);
    expect(getByText('Test message')).toBeTruthy();
  });

  it('renders for success type', () => {
    const { getByText } = render(<Toast {...defaultProps()} type="success" />);
    expect(getByText('Test message')).toBeTruthy();
  });

  it('renders for error type', () => {
    const { getByText } = render(<Toast {...defaultProps()} type="error" />);
    expect(getByText('Test message')).toBeTruthy();
  });

  it('renders for info type', () => {
    const { getByText } = render(<Toast {...defaultProps()} type="info" />);
    expect(getByText('Test message')).toBeTruthy();
  });

  it('renders when visible is true', () => {
    const { toJSON } = render(<Toast {...defaultProps()} visible={true} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders when visible is false', () => {
    const { toJSON } = render(<Toast {...defaultProps()} visible={false} />);
    // Component still renders the Animated.View, but with opacity 0
    expect(toJSON()).toBeTruthy();
  });
});
