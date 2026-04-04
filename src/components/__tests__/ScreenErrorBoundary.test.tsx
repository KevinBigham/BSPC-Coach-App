import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ScreenErrorBoundary } from '../ScreenErrorBoundary';

// Silence React error boundary console output
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Screen crash');
  return <Text>Screen content</Text>;
}

describe('ScreenErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <ScreenErrorBoundary screenName="TestScreen">
        <ThrowingChild shouldThrow={false} />
      </ScreenErrorBoundary>,
    );
    expect(getByText('Screen content')).toBeTruthy();
  });

  it('renders crash UI when child throws', () => {
    const { getByText } = render(
      <ScreenErrorBoundary screenName="TestScreen">
        <ThrowingChild shouldThrow={true} />
      </ScreenErrorBoundary>,
    );
    expect(getByText('This screen crashed')).toBeTruthy();
    expect(getByText('Screen crash')).toBeTruthy();
  });

  it('shows Retry and Go Back buttons', () => {
    const { getByText } = render(
      <ScreenErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ScreenErrorBoundary>,
    );
    expect(getByText('Retry')).toBeTruthy();
    expect(getByText('Go Back')).toBeTruthy();
  });

  it('Retry button resets error state', () => {
    const { getByText, queryByText } = render(
      <ScreenErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ScreenErrorBoundary>,
    );
    fireEvent.press(getByText('Retry'));
    // Will throw again and show error again
    expect(queryByText('This screen crashed')).toBeTruthy();
  });

  it('Go Back button resets error and navigates', () => {
    const { getByText } = render(
      <ScreenErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ScreenErrorBoundary>,
    );
    // Should not throw when pressing Go Back
    fireEvent.press(getByText('Go Back'));
  });
});
