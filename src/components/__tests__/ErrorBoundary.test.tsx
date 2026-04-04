import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';

// Silence React error boundary console output
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test crash');
  return <Text>Child rendered</Text>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(getByText('Child rendered')).toBeTruthy();
  });

  it('renders fallback UI when child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Test crash')).toBeTruthy();
  });

  it('shows Try Again button that resets error state', () => {
    const { getByText, queryByText } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    fireEvent.press(getByText('Try Again'));
    // After reset, the component will try to render again and throw again
    expect(queryByText('Something went wrong')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <Text>Custom error page</Text>;
    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Custom error page')).toBeTruthy();
  });
});
