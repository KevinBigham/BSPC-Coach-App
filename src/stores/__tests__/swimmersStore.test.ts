jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

jest.mock('../../services/swimmers', () => ({
  subscribeSwimmers: jest.fn(
    (_activeOnly: boolean, callback: (swimmers: Array<{ id: string }>) => void) => {
      callback([]);
      return jest.fn(); // unsubscribe
    },
  ),
}));

import { useSwimmersStore } from '../swimmersStore';
import { subscribeSwimmers } from '../../services/swimmers';
import type { Swimmer } from '../../types/firestore.types';

const mockSubscribeSwimmers = subscribeSwimmers as jest.Mock;

type SwimmerWithId = Swimmer & { id: string };

function makeSwimmer(overrides: Partial<SwimmerWithId> & { id: string }): SwimmerWithId {
  return {
    firstName: 'Test',
    lastName: 'Swimmer',
    displayName: 'Test Swimmer',
    dateOfBirth: new Date(),
    gender: 'M',
    group: 'Gold',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'coach1',
    ...overrides,
  };
}

describe('swimmersStore', () => {
  beforeEach(() => {
    useSwimmersStore.setState(useSwimmersStore.getInitialState());
    mockSubscribeSwimmers.mockClear();
    mockSubscribeSwimmers.mockImplementation(
      (_active: boolean, cb: (s: SwimmerWithId[]) => void) => {
        cb([]);
        return jest.fn();
      },
    );
  });

  it('has correct initial state', () => {
    const state = useSwimmersStore.getState();
    expect(state.swimmers).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state._unsubscribe).toBeNull();
  });

  it('subscribe calls subscribeSwimmers and stores data', () => {
    const swimmers = [
      makeSwimmer({ id: 's1', firstName: 'Alice' }),
      makeSwimmer({ id: 's2', firstName: 'Bob' }),
    ];
    mockSubscribeSwimmers.mockImplementation(
      (_active: boolean, cb: (s: SwimmerWithId[]) => void) => {
        cb(swimmers);
        return jest.fn();
      },
    );

    useSwimmersStore.getState().subscribe();

    const state = useSwimmersStore.getState();
    expect(state.swimmers).toEqual(swimmers);
    expect(state.loading).toBe(false);
    expect(mockSubscribeSwimmers).toHaveBeenCalledWith(true, expect.any(Function));
  });

  it('subscribe returns unsubscribe function that cleans up', () => {
    const mockUnsub = jest.fn();
    mockSubscribeSwimmers.mockImplementation(
      (_active: boolean, cb: (s: SwimmerWithId[]) => void) => {
        cb([]);
        return mockUnsub;
      },
    );

    const unsub = useSwimmersStore.getState().subscribe();
    unsub();

    expect(mockUnsub).toHaveBeenCalled();
    expect(useSwimmersStore.getState()._unsubscribe).toBeNull();
  });

  it('subscribe avoids double subscription', () => {
    useSwimmersStore.getState().subscribe();
    const callCount = mockSubscribeSwimmers.mock.calls.length;

    // Second subscribe should return existing and not call subscribeSwimmers again
    useSwimmersStore.getState().subscribe();
    expect(mockSubscribeSwimmers.mock.calls.length).toBe(callCount);
  });

  it('getSwimmerById returns the correct swimmer', () => {
    const swimmers = [
      makeSwimmer({ id: 's1', firstName: 'Alice' }),
      makeSwimmer({ id: 's2', firstName: 'Bob' }),
    ];
    useSwimmersStore.setState({ swimmers });

    expect(useSwimmersStore.getState().getSwimmerById('s1')?.firstName).toBe('Alice');
    expect(useSwimmersStore.getState().getSwimmerById('s2')?.firstName).toBe('Bob');
    expect(useSwimmersStore.getState().getSwimmerById('nope')).toBeUndefined();
  });

  it('getSwimmersByGroup filters correctly', () => {
    const swimmers = [
      makeSwimmer({ id: 's1', group: 'Gold' }),
      makeSwimmer({ id: 's2', group: 'Silver' }),
      makeSwimmer({ id: 's3', group: 'Gold' }),
    ];
    useSwimmersStore.setState({ swimmers });

    const varsity = useSwimmersStore.getState().getSwimmersByGroup('Gold');
    expect(varsity).toHaveLength(2);
    expect(varsity.map((s) => s.id)).toEqual(['s1', 's3']);

    const jv = useSwimmersStore.getState().getSwimmersByGroup('Silver');
    expect(jv).toHaveLength(1);
    expect(jv[0].id).toBe('s2');
  });

  it('getSwimmersByGroup returns empty for non-matching group', () => {
    const swimmers = [makeSwimmer({ id: 's1', group: 'Gold' })];
    useSwimmersStore.setState({ swimmers });

    expect(useSwimmersStore.getState().getSwimmersByGroup('Bronze')).toEqual([]);
  });

  it('subscribe callback updates store when new data arrives', () => {
    let capturedCallback: ((s: SwimmerWithId[]) => void) | null = null;
    mockSubscribeSwimmers.mockImplementation(
      (_active: boolean, cb: (s: SwimmerWithId[]) => void) => {
        cb([]);
        capturedCallback = cb;
        return jest.fn();
      },
    );

    useSwimmersStore.getState().subscribe();
    expect(useSwimmersStore.getState().swimmers).toEqual([]);

    // Simulate new data arriving
    const updated = [makeSwimmer({ id: 's1', firstName: 'New' })];
    capturedCallback!(updated);

    expect(useSwimmersStore.getState().swimmers).toEqual(updated);
    expect(useSwimmersStore.getState().loading).toBe(false);
  });

  it('loading stays true until callback fires', () => {
    mockSubscribeSwimmers.mockImplementation(() => jest.fn());

    useSwimmersStore.getState().subscribe();
    expect(useSwimmersStore.getState().loading).toBe(true);
  });
});
