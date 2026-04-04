import React from 'react';
import { render } from '@testing-library/react-native';
import SplitComparisonChart, { type RaceData } from '../SplitComparisonChart';

const MOCK_RACE_A: RaceData = {
  name: 'Conference Meet',
  splits: [3012, 3511],
  totalTime: 6523,
};

const MOCK_RACE_B: RaceData = {
  name: 'State Prelims',
  splits: [2950, 3400],
  totalTime: 6350,
};

const MOCK_RACE_C: RaceData = {
  name: 'State Finals',
  splits: [2900, 3300],
  totalTime: 6200,
};

describe('SplitComparisonChart', () => {
  it('renders without crashing with valid data', () => {
    const { toJSON } = render(<SplitComparisonChart races={[MOCK_RACE_A]} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders empty state when races array is empty', () => {
    const { getByText } = render(<SplitComparisonChart races={[]} />);
    expect(getByText('No race data to compare')).toBeTruthy();
  });

  it('renders empty state when races is undefined-like', () => {
    const { getByText } = render(<SplitComparisonChart races={[] as RaceData[]} />);
    expect(getByText('No race data to compare')).toBeTruthy();
  });

  it('renders legend items for each race', () => {
    const { getByText } = render(<SplitComparisonChart races={[MOCK_RACE_A, MOCK_RACE_B]} />);
    expect(getByText('Conference Meet')).toBeTruthy();
    expect(getByText('State Prelims')).toBeTruthy();
  });

  it('renders split bars for each split index', () => {
    const { getByTestId } = render(<SplitComparisonChart races={[MOCK_RACE_A, MOCK_RACE_B]} />);
    // Split 0, Race 0
    expect(getByTestId('split-bar-0-0')).toBeTruthy();
    // Split 0, Race 1
    expect(getByTestId('split-bar-0-1')).toBeTruthy();
    // Split 1, Race 0
    expect(getByTestId('split-bar-1-0')).toBeTruthy();
  });

  it('handles three races (max compare)', () => {
    const { getByText } = render(
      <SplitComparisonChart races={[MOCK_RACE_A, MOCK_RACE_B, MOCK_RACE_C]} />,
    );
    expect(getByText('Conference Meet')).toBeTruthy();
    expect(getByText('State Prelims')).toBeTruthy();
    expect(getByText('State Finals')).toBeTruthy();
  });

  it('displays formatted total times in legend', () => {
    const { getByText } = render(<SplitComparisonChart races={[MOCK_RACE_A]} />);
    // 6523 hundredths = 1:05.23
    expect(getByText('1:05.23')).toBeTruthy();
  });

  it('handles races with unequal split counts', () => {
    const shortRace: RaceData = {
      name: 'Short Race',
      splits: [2800],
      totalTime: 2800,
    };
    const { toJSON } = render(<SplitComparisonChart races={[MOCK_RACE_A, shortRace]} />);
    expect(toJSON()).toBeTruthy();
  });
});
