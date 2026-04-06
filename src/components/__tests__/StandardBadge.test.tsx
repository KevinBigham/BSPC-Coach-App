import React from 'react';
import { render } from '@testing-library/react-native';
import StandardBadge from '../StandardBadge';
import type { StandardLevel } from '../../types/firestore.types';

describe('StandardBadge', () => {
  const levels: StandardLevel[] = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'];

  it.each(levels)('renders level "%s"', (level) => {
    const { getByText } = render(<StandardBadge level={level} />);
    expect(getByText(level)).toBeTruthy();
  });

  it('renders with default md size', () => {
    const { toJSON } = render(<StandardBadge level="A" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with sm size', () => {
    const { getByText } = render(<StandardBadge level="AA" size="sm" />);
    expect(getByText('AA')).toBeTruthy();
  });

  it('renders with lg size', () => {
    const { getByText } = render(<StandardBadge level="AAA" size="lg" />);
    expect(getByText('AAA')).toBeTruthy();
  });

  it('renders different levels with different visual output', () => {
    const { toJSON: jsonB } = render(<StandardBadge level="B" />);
    const { toJSON: jsonAAAA } = render(<StandardBadge level="AAAA" />);
    // They should produce different output due to different colors
    expect(JSON.stringify(jsonB())).not.toBe(JSON.stringify(jsonAAAA()));
  });
});
