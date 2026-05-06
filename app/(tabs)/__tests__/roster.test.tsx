import { fireEvent, render } from '@testing-library/react-native';

import RosterScreen from '../roster';
import type { Swimmer } from '../../../src/types/firestore.types';

const mockActiveSwimmers: Array<Swimmer & { id: string }> = [
  {
    id: 'swim-diamond-1',
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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
  {
    id: 'swim-bronze-1',
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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
  {
    id: 'swim-silver-1',
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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
];

jest.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false }),
}));

jest.mock('../../../src/config/firebase', () => ({
  db: {},
}));

jest.mock('../../../src/stores/swimmersStore', () => ({
  useSwimmersStore: (selector: (state: { swimmers: typeof mockActiveSwimmers }) => unknown) =>
    selector({ swimmers: mockActiveSwimmers }),
}));

jest.mock('../../../src/services/swimmers', () => ({
  subscribeSwimmers: jest.fn(),
  updateSwimmer: jest.fn(),
}));

jest.mock('../../../src/services/export', () => ({
  exportRosterCSV: jest.fn(() => 'csv'),
  shareCSV: jest.fn(),
}));

jest.mock('../../../src/services/aggregations', () => ({
  getPRCount: jest.fn(() => 2),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id })),
  onSnapshot: jest.fn((ref: { id: string }, callback: (snap: unknown) => void) => {
    if (ref.id === 'attendance_swim-bronze-1') {
      callback({
        exists: () => true,
        data: () => ({ attendancePercent30: 90 }),
      });
    }
    if (ref.id === 'swimmer_swim-bronze-1') {
      callback({
        exists: () => true,
        data: () => ({ prsByEvent: { '50 Free': {}, '100 Free': {} } }),
      });
    }
    return jest.fn();
  }),
}));

describe('RosterScreen group-first sections', () => {
  it('renders GROUPS-ordered non-empty sections with aggregation stats', () => {
    const { getAllByText, getByText, queryByText } = render(<RosterScreen />);

    const bronzeHeader = getByText('BRONZE');
    const silverHeader = getByText('SILVER');
    const diamondHeader = getByText('DIAMOND');

    expect(bronzeHeader).toBeTruthy();
    expect(silverHeader).toBeTruthy();
    expect(diamondHeader).toBeTruthy();
    expect(queryByText('GOLD')).toBeNull();
    expect(queryByText('PLATINUM')).toBeNull();

    expect(getByText('Alpha, Bree')).toBeTruthy();
    expect(getByText('90%')).toBeTruthy();
    expect(getByText('2 PRs')).toBeTruthy();

    expect(getAllByText(/BRONZE|SILVER|DIAMOND/).map((node) => node.props.children)).toEqual([
      'BRONZE',
      'SILVER',
      'DIAMOND',
    ]);
  });

  it('narrows to one section when a group filter chip is selected', () => {
    const { getByText, queryByText } = render(<RosterScreen />);

    fireEvent.press(getByText('Silver (1)'));

    expect(getByText('SILVER')).toBeTruthy();
    expect(queryByText('BRONZE')).toBeNull();
    expect(queryByText('DIAMOND')).toBeNull();
    expect(getByText('Middle, Sam')).toBeTruthy();
  });
});
