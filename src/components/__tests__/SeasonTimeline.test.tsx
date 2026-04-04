import React from 'react';
import { render } from '@testing-library/react-native';
import { SeasonTimeline } from '../SeasonTimeline';
import type { SeasonPhase } from '../../types/firestore.types';

const phases: SeasonPhase[] = [
  {
    name: 'Base',
    type: 'base',
    startDate: '2026-09-01',
    endDate: '2026-10-12',
    weeklyYardage: 20000,
    focusAreas: ['aerobic'],
  },
  {
    name: 'Build',
    type: 'build1',
    startDate: '2026-10-13',
    endDate: '2026-11-09',
    weeklyYardage: 28000,
    focusAreas: ['threshold'],
  },
  {
    name: 'Taper',
    type: 'taper',
    startDate: '2026-11-10',
    endDate: '2026-11-23',
    weeklyYardage: 14000,
    focusAreas: ['speed'],
  },
];

describe('SeasonTimeline', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<SeasonTimeline phases={phases} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders all phase blocks', () => {
    const { getByText } = render(<SeasonTimeline phases={phases} />);
    expect(getByText('BASE')).toBeTruthy();
    expect(getByText('BUILD I')).toBeTruthy();
    expect(getByText('TAPER')).toBeTruthy();
  });

  it('shows yardage per week', () => {
    const { getByText } = render(<SeasonTimeline phases={phases} />);
    expect(getByText('20k/wk')).toBeTruthy();
    expect(getByText('28k/wk')).toBeTruthy();
    expect(getByText('14k/wk')).toBeTruthy();
  });

  it('renders legend items', () => {
    const { getByText } = render(<SeasonTimeline phases={phases} />);
    expect(getByText('Base')).toBeTruthy();
    expect(getByText('Build')).toBeTruthy();
    expect(getByText('Taper')).toBeTruthy();
  });

  it('renders with currentDate prop', () => {
    const { toJSON } = render(<SeasonTimeline phases={phases} currentDate="2026-10-20" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders empty when no phases', () => {
    const { toJSON } = render(<SeasonTimeline phases={[]} />);
    expect(toJSON()).toBeTruthy();
  });
});
