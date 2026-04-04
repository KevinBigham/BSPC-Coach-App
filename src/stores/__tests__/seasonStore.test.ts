jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(() => ({ path: 'mock' })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn((_query: unknown, callback: (snap: unknown) => void) => {
    callback({ docs: [] });
    return jest.fn();
  }),
  addDoc: jest.fn().mockResolvedValue({ id: 'mock-new-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  doc: jest.fn(() => ({ path: 'mock/doc' })),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  serverTimestamp: jest.fn(),
}));
jest.mock('../../config/firebase', () => ({
  db: {},
}));

import { useSeasonStore } from '../seasonStore';
import type { SeasonPlan } from '../../types/firestore.types';

// Reset store between tests
beforeEach(() => {
  useSeasonStore.setState({
    plans: [],
    activePlan: null,
    weeks: [],
    loading: false,
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const mockPlan: SeasonPlan & { id: string } = {
  id: 'season-1',
  name: 'Fall 2026 SCY',
  group: 'Gold',
  startDate: '2026-09-01',
  endDate: '2026-11-30',
  phases: [
    {
      name: 'Base',
      type: 'base',
      startDate: '2026-09-01',
      endDate: '2026-10-12',
      weeklyYardage: 20000,
      focusAreas: ['aerobic'],
    },
  ],
  totalWeeks: 13,
  coachId: 'test-coach-uid',
  coachName: 'Coach Test',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('seasonStore', () => {
  it('has correct initial state', () => {
    const state = useSeasonStore.getState();
    expect(state.plans).toEqual([]);
    expect(state.activePlan).toBeNull();
    expect(state.weeks).toEqual([]);
    expect(state.loading).toBe(false);
  });

  it('setActivePlan sets the active plan', () => {
    useSeasonStore.getState().setActivePlan(mockPlan);
    expect(useSeasonStore.getState().activePlan).toEqual(mockPlan);
  });

  it('setActivePlan can clear the active plan', () => {
    useSeasonStore.getState().setActivePlan(mockPlan);
    useSeasonStore.getState().setActivePlan(null);
    expect(useSeasonStore.getState().activePlan).toBeNull();
  });

  it('subscribePlans returns unsubscribe function', () => {
    const unsub = useSeasonStore.getState().subscribePlans('test-coach-uid');
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('subscribeWeeks returns unsubscribe function', () => {
    const unsub = useSeasonStore.getState().subscribeWeeks('season-1');
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('create calls service and returns id', async () => {
    const id = await useSeasonStore.getState().create({
      name: 'Test Season',
      group: 'Gold',
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      phases: [],
      totalWeeks: 13,
      coachId: 'test-coach-uid',
      coachName: 'Coach Test',
    });
    expect(id).toBeTruthy();
  });

  it('update calls service without throwing', async () => {
    await expect(
      useSeasonStore.getState().update('season-1', { name: 'Updated' }),
    ).resolves.toBeUndefined();
  });

  it('remove calls service without throwing', async () => {
    await expect(useSeasonStore.getState().remove('season-1')).resolves.toBeUndefined();
  });

  it('remove clears activePlan if it matches', async () => {
    useSeasonStore.getState().setActivePlan(mockPlan);
    await useSeasonStore.getState().remove('season-1');
    expect(useSeasonStore.getState().activePlan).toBeNull();
    expect(useSeasonStore.getState().weeks).toEqual([]);
  });

  it('remove does not clear activePlan if different id', async () => {
    useSeasonStore.getState().setActivePlan(mockPlan);
    await useSeasonStore.getState().remove('other-plan');
    expect(useSeasonStore.getState().activePlan).toEqual(mockPlan);
  });

  it('upsertWeek calls service and returns id', async () => {
    const id = await useSeasonStore.getState().upsertWeek('season-1', {
      weekNumber: 1,
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      phase: 'base',
      targetYardage: 20000,
      practiceCount: 5,
      practicePlanIds: [],
    });
    expect(id).toBeTruthy();
  });
});
