import { render } from '@testing-library/react-native';

import BrowsePublicWorkoutsScreen from '../browse';
import type { PracticePlan } from '../../../src/types/firestore.types';

const mockSubscribePublicWorkouts = jest.fn();

jest.mock('../../../src/services/workoutLibrary', () => ({
  subscribePublicWorkouts: (...args: unknown[]) => mockSubscribePublicWorkouts(...args),
}));

jest.mock('../../../src/services/practicePlans', () => ({
  calculateTotalYardage: (sets: { items: { reps: number; distance: number }[] }[]) =>
    sets.reduce(
      (setSum, set) =>
        setSum + set.items.reduce((itemSum, item) => itemSum + item.reps * item.distance, 0),
      0,
    ),
}));

function buildPlan(overrides: Partial<PracticePlan> = {}): PracticePlan & { id: string } {
  return {
    id: 'plan-1',
    title: 'Gold Pace Builder',
    description: 'Threshold work',
    group: 'Gold',
    isTemplate: true,
    public: true,
    coachId: 'coach-1',
    coachName: 'Coach Lane',
    totalDuration: 75,
    tags: ['pace', 'turns'],
    ratings: { 'coach-2': 4, 'coach-3': 5 },
    sets: [
      {
        order: 0,
        name: 'Main',
        category: 'Main Set',
        items: [
          {
            order: 0,
            reps: 8,
            distance: 100,
            stroke: 'Freestyle',
            focusPoints: [],
          },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BrowsePublicWorkoutsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to public workouts and renders cards on data arrival', () => {
    mockSubscribePublicWorkouts.mockImplementation((callback: (plans: unknown[]) => void) => {
      callback([buildPlan()]);
      return jest.fn();
    });

    const { getByText } = render(<BrowsePublicWorkoutsScreen />);

    expect(mockSubscribePublicWorkouts).toHaveBeenCalled();
    expect(getByText('Gold Pace Builder')).toBeTruthy();
    expect(getByText('Gold')).toBeTruthy();
    expect(getByText('800 yds')).toBeTruthy();
    expect(getByText('75 min')).toBeTruthy();
    expect(getByText('Coach Lane')).toBeTruthy();
    expect(getByText('4.5 avg')).toBeTruthy();
    expect(getByText('pace')).toBeTruthy();
    expect(getByText('turns')).toBeTruthy();
  });

  it('shows an empty state when no public workouts are available', () => {
    mockSubscribePublicWorkouts.mockImplementation((callback: (plans: unknown[]) => void) => {
      callback([]);
      return jest.fn();
    });

    const { getByText } = render(<BrowsePublicWorkoutsScreen />);

    expect(getByText('No public plans yet')).toBeTruthy();
  });
});
