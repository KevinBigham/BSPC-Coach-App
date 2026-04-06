import React from 'react';
import { render } from '@testing-library/react-native';
import PsychSheet from '../PsychSheet';
import type { PsychSheetEntry } from '../../types/meet.types';

const makePsychSheet = (): PsychSheetEntry[] => [
  {
    eventName: '50 Freestyle',
    eventNumber: 1,
    gender: 'M',
    entries: [
      {
        swimmerName: 'Michael P',
        group: 'Platinum' as any,
        age: 17,
        seedTime: 2350,
        seedTimeDisplay: '23.50',
      },
      {
        swimmerName: 'Ryan L',
        group: 'Gold' as any,
        age: 15,
        seedTime: 2520,
        seedTimeDisplay: '25.20',
      },
    ],
  },
  {
    eventName: '100 Butterfly',
    eventNumber: 3,
    gender: 'F',
    entries: [
      {
        swimmerName: 'Katie D',
        group: 'Platinum' as any,
        age: 16,
        seedTime: 5840,
        seedTimeDisplay: '58.40',
      },
    ],
  },
];

describe('PsychSheet', () => {
  it('renders meet name uppercased', () => {
    const { getByText } = render(
      <PsychSheet psychSheet={makePsychSheet()} meetName="Spring Invite" />,
    );
    expect(getByText('SPRING INVITE')).toBeTruthy();
  });

  it('renders PSYCH SHEET subtitle', () => {
    const { getByText } = render(
      <PsychSheet psychSheet={makePsychSheet()} meetName="Spring Invite" />,
    );
    expect(getByText('PSYCH SHEET')).toBeTruthy();
  });

  it('renders event names', () => {
    const { getByText } = render(<PsychSheet psychSheet={makePsychSheet()} meetName="Test Meet" />);
    expect(getByText('50 Freestyle')).toBeTruthy();
    expect(getByText('100 Butterfly')).toBeTruthy();
  });

  it('renders event numbers', () => {
    const { getByText } = render(<PsychSheet psychSheet={makePsychSheet()} meetName="Test Meet" />);
    expect(getByText('#1')).toBeTruthy();
    expect(getByText('#3')).toBeTruthy();
  });

  it('renders gender labels', () => {
    const { getByText } = render(<PsychSheet psychSheet={makePsychSheet()} meetName="Test Meet" />);
    expect(getByText('BOYS')).toBeTruthy();
    expect(getByText('GIRLS')).toBeTruthy();
  });

  it('renders swimmer names and seed times', () => {
    const { getByText } = render(<PsychSheet psychSheet={makePsychSheet()} meetName="Test Meet" />);
    expect(getByText('Michael P')).toBeTruthy();
    expect(getByText('23.50')).toBeTruthy();
    expect(getByText('Katie D')).toBeTruthy();
    expect(getByText('58.40')).toBeTruthy();
  });

  it('renders column headers', () => {
    const { getAllByText } = render(
      <PsychSheet psychSheet={makePsychSheet()} meetName="Test Meet" />,
    );
    expect(getAllByText('NAME').length).toBeGreaterThan(0);
    expect(getAllByText('SEED').length).toBeGreaterThan(0);
  });

  it('handles empty psychSheet array', () => {
    const { getByText } = render(<PsychSheet psychSheet={[]} meetName="Empty Meet" />);
    expect(getByText('No entries to display')).toBeTruthy();
  });

  it('shows no entries message for event with empty entries', () => {
    const sheet: PsychSheetEntry[] = [
      { eventName: '200 IM', eventNumber: 5, gender: 'M', entries: [] },
    ];
    const { getByText } = render(<PsychSheet psychSheet={sheet} meetName="Test Meet" />);
    expect(getByText('No entries')).toBeTruthy();
  });
});
