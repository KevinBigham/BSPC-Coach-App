import React from 'react';
import { render } from '@testing-library/react-native';
import ProgressionChart, { type ProgressionDataPoint } from '../ProgressionChart';

const MOCK_DATA: ProgressionDataPoint[] = [
  { date: 'Sep 15', time: 6800, eventName: '100 Free' },
  { date: 'Oct 3', time: 6650, eventName: '100 Free' },
  { date: 'Nov 12', time: 6523, eventName: '100 Free' },
  { date: 'Dec 1', time: 6400, eventName: '100 Free' },
];

const SINGLE_POINT: ProgressionDataPoint[] = [{ date: 'Jan 5', time: 3200, eventName: '50 Free' }];

describe('ProgressionChart', () => {
  it('renders without crashing with valid data', () => {
    const { toJSON } = render(<ProgressionChart data={MOCK_DATA} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders empty state when data is empty', () => {
    const { getByText } = render(<ProgressionChart data={[]} />);
    expect(getByText('No progression data available')).toBeTruthy();
  });

  it('shows IMPROVED label when times decreased', () => {
    const { getByText } = render(<ProgressionChart data={MOCK_DATA} />);
    expect(getByText('IMPROVED')).toBeTruthy();
  });

  it('shows SLOWER label when times increased', () => {
    const slowerData: ProgressionDataPoint[] = [
      { date: 'Sep 15', time: 6400, eventName: '100 Free' },
      { date: 'Oct 3', time: 6800, eventName: '100 Free' },
    ];
    const { getByText } = render(<ProgressionChart data={slowerData} />);
    expect(getByText('SLOWER')).toBeTruthy();
  });

  it('renders bar for each data point', () => {
    const { getByTestId } = render(<ProgressionChart data={MOCK_DATA} />);
    expect(getByTestId('progression-bar-0')).toBeTruthy();
    expect(getByTestId('progression-bar-1')).toBeTruthy();
    expect(getByTestId('progression-bar-2')).toBeTruthy();
    expect(getByTestId('progression-bar-3')).toBeTruthy();
  });

  it('displays the title when provided', () => {
    const { getByText } = render(<ProgressionChart data={MOCK_DATA} title="John Doe - 100 Free" />);
    expect(getByText('John Doe - 100 Free')).toBeTruthy();
  });

  it('handles a single data point', () => {
    const { toJSON, getByText } = render(<ProgressionChart data={SINGLE_POINT} />);
    expect(toJSON()).toBeTruthy();
    expect(getByText('NO CHANGE')).toBeTruthy();
  });

  it('shows entry count in stats', () => {
    const { getByText } = render(<ProgressionChart data={MOCK_DATA} />);
    expect(getByText('4')).toBeTruthy();
  });
});
