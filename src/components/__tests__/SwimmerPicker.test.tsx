import { fireEvent, render } from '@testing-library/react-native';
import { SectionList } from 'react-native';

import SwimmerPicker from '../SwimmerPicker';
import type { Swimmer } from '../../types/firestore.types';

const mockSwimmers: Array<Swimmer & { id: string }> = [
  {
    id: 'swim-diamond',
    firstName: 'Della',
    lastName: 'Zulu',
    displayName: 'Della Zulu',
    dateOfBirth: new Date('2011-01-01T00:00:00Z'),
    gender: 'F',
    group: 'Diamond',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    mediaConsent: { granted: true, date: new Date('2026-01-01T00:00:00Z') },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
  {
    id: 'swim-bronze',
    firstName: 'Bree',
    lastName: 'Alpha',
    displayName: 'Bree Alpha',
    dateOfBirth: new Date('2014-01-01T00:00:00Z'),
    gender: 'F',
    group: 'Bronze',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    mediaConsent: { granted: true, date: new Date('2026-01-01T00:00:00Z') },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
  {
    id: 'swim-silver',
    firstName: 'Sam',
    lastName: 'Middle',
    displayName: 'Sam Middle',
    dateOfBirth: new Date('2013-01-01T00:00:00Z'),
    gender: 'M',
    group: 'Silver',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    mediaConsent: { granted: true, date: new Date('2026-01-01T00:00:00Z') },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
  {
    id: 'swim-no-consent',
    firstName: 'Nora',
    lastName: 'Blocked',
    displayName: 'Nora Blocked',
    dateOfBirth: new Date('2014-01-01T00:00:00Z'),
    gender: 'F',
    group: 'Gold',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    mediaConsent: { granted: false, date: new Date('2026-01-01T00:00:00Z') },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
  {
    id: 'swim-dnp',
    firstName: 'Piper',
    lastName: 'Private',
    displayName: 'Piper Private',
    dateOfBirth: new Date('2014-01-01T00:00:00Z'),
    gender: 'F',
    group: 'Gold',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    doNotPhotograph: true,
    mediaConsent: { granted: true, date: new Date('2026-01-01T00:00:00Z') },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
  {
    id: 'swim-inactive',
    firstName: 'Ian',
    lastName: 'Inactive',
    displayName: 'Ian Inactive',
    dateOfBirth: new Date('2014-01-01T00:00:00Z'),
    gender: 'M',
    group: 'Platinum',
    active: false,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    mediaConsent: { granted: true, date: new Date('2026-01-01T00:00:00Z') },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
];

jest.mock('../../stores/swimmersStore', () => ({
  useSwimmersStore: (selector: (state: { swimmers: typeof mockSwimmers }) => unknown) =>
    selector({ swimmers: mockSwimmers }),
}));

describe('SwimmerPicker', () => {
  it('renders non-empty groups in GROUPS order', () => {
    const { UNSAFE_getByType, getByText, queryByText } = render(
      <SwimmerPicker mode="multi" onSelect={jest.fn()} />,
    );
    const sectionList = UNSAFE_getByType(SectionList);
    const sectionTitles = sectionList.props.sections.map((section: { title: string }) =>
      section.title.toUpperCase(),
    );

    expect(getByText('BRONZE')).toBeTruthy();
    expect(getByText('SILVER')).toBeTruthy();
    expect(queryByText('GOLD')).toBeTruthy();
    expect(queryByText('PLATINUM')).toBeNull();
    expect(sectionTitles).toEqual(
      ['Bronze', 'Silver', 'Gold', 'Diamond'].map((g) => g.toUpperCase()),
    );
  });

  it('returns one id in single-select mode', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<SwimmerPicker mode="single" onSelect={onSelect} />);

    fireEvent.press(getByText('Bree Alpha'));

    expect(onSelect).toHaveBeenCalledWith(['swim-bronze']);
  });

  it('toggles ids in multi-select mode', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<SwimmerPicker mode="multi" onSelect={onSelect} />);

    fireEvent.press(getByText('Bree Alpha'));
    fireEvent.press(getByText('Sam Middle'));
    fireEvent.press(getByText('Bree Alpha'));

    expect(onSelect).toHaveBeenNthCalledWith(1, ['swim-bronze']);
    expect(onSelect).toHaveBeenNthCalledWith(2, ['swim-bronze', 'swim-silver']);
    expect(onSelect).toHaveBeenNthCalledWith(3, ['swim-silver']);
  });

  it('filters swimmers without consent and Do Not Photograph when consent is required', () => {
    const { queryByText } = render(
      <SwimmerPicker mode="multi" requireConsent onSelect={jest.fn()} />,
    );

    expect(queryByText('Nora Blocked')).toBeNull();
    expect(queryByText('Piper Private')).toBeNull();
    expect(queryByText('Bree Alpha')).toBeTruthy();
  });

  it('excludes inactive swimmers by default', () => {
    const { queryByText } = render(<SwimmerPicker mode="multi" onSelect={jest.fn()} />);

    expect(queryByText('Ian Inactive')).toBeNull();
  });
});
