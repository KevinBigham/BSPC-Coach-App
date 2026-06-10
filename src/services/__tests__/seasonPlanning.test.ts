// Pure utility functions + the DATA LAYER pins (04 §H: data-layer tests FIRST,
// against the CURRENT Firestore implementation, before any swap).

// Must mock firebase modules before importing anything that uses them
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-doc-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));
jest.mock('../../config/firebase', () => ({
  db: {},
}));

import {
  subscribeSeasonPlans,
  createSeasonPlan,
  updateSeasonPlan,
  deleteSeasonPlan,
  subscribeWeekPlans,
  upsertWeekPlan,
  calculateSeasonYardage,
  calculateTaperProgress,
  getCurrentPhase,
  generateWeekPlans,
} from '../seasonPlanning';
import type { SeasonPhase, WeekPlan } from '../../types/firestore.types';

const firestore = require('firebase/firestore');

const samplePhases: SeasonPhase[] = [
  {
    name: 'Base',
    type: 'base',
    startDate: '2026-09-01',
    endDate: '2026-10-12',
    weeklyYardage: 20000,
    focusAreas: ['aerobic', 'technique'],
  },
  {
    name: 'Build I',
    type: 'build1',
    startDate: '2026-10-13',
    endDate: '2026-11-09',
    weeklyYardage: 28000,
    focusAreas: ['threshold', 'race pace'],
  },
  {
    name: 'Taper',
    type: 'taper',
    startDate: '2026-11-10',
    endDate: '2026-11-23',
    weeklyYardage: 14000,
    focusAreas: ['speed', 'rest'],
  },
  {
    name: 'Championship',
    type: 'race',
    startDate: '2026-11-24',
    endDate: '2026-11-30',
    weeklyYardage: 8000,
    focusAreas: ['race'],
  },
];

describe('calculateSeasonYardage', () => {
  it('sums weekly yardage across all phases based on duration', () => {
    const result = calculateSeasonYardage(samplePhases);
    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
  });

  it('returns 0 for empty phases', () => {
    expect(calculateSeasonYardage([])).toBe(0);
  });

  it('treats single-day phase as 1 week minimum', () => {
    const phases: SeasonPhase[] = [
      {
        name: 'Meet Day',
        type: 'race',
        startDate: '2026-11-24',
        endDate: '2026-11-24',
        weeklyYardage: 5000,
        focusAreas: [],
      },
    ];
    expect(calculateSeasonYardage(phases)).toBe(5000);
  });
});

describe('calculateTaperProgress', () => {
  it('calculates percentage of yardage reduction', () => {
    expect(calculateTaperProgress(30000, 15000)).toBe(50);
  });

  it('returns 0 when peak is 0', () => {
    expect(calculateTaperProgress(0, 15000)).toBe(0);
  });

  it('caps at 100 when current is 0', () => {
    expect(calculateTaperProgress(30000, 0)).toBe(100);
  });

  it('returns 0 when no reduction', () => {
    expect(calculateTaperProgress(30000, 30000)).toBe(0);
  });

  it('handles negative peak gracefully', () => {
    expect(calculateTaperProgress(-1000, 5000)).toBe(0);
  });
});

describe('getCurrentPhase', () => {
  it('returns the phase containing the given date', () => {
    const phase = getCurrentPhase(samplePhases, '2026-10-20');
    expect(phase).not.toBeNull();
    expect(phase!.type).toBe('build1');
  });

  it('returns null when date is outside all phases', () => {
    expect(getCurrentPhase(samplePhases, '2027-01-01')).toBeNull();
  });

  it('returns null for empty phases', () => {
    expect(getCurrentPhase([], '2026-10-01')).toBeNull();
  });

  it('includes the start date of a phase', () => {
    const phase = getCurrentPhase(samplePhases, '2026-09-01');
    expect(phase).not.toBeNull();
    expect(phase!.type).toBe('base');
  });

  it('includes the end date of a phase', () => {
    const phase = getCurrentPhase(samplePhases, '2026-10-12');
    expect(phase).not.toBeNull();
    expect(phase!.type).toBe('base');
  });
});

describe('generateWeekPlans', () => {
  it('generates sequential weeks from phases', () => {
    const weeks = generateWeekPlans(samplePhases);
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks[0].weekNumber).toBe(1);
    expect(weeks[0].phase).toBe('base');
  });

  it('assigns correct phase type to each week', () => {
    const weeks = generateWeekPlans(samplePhases);
    const taperWeeks = weeks.filter((w) => w.phase === 'taper');
    expect(taperWeeks.length).toBeGreaterThan(0);
    taperWeeks.forEach((w) => {
      expect(w.targetYardage).toBe(14000);
    });
  });

  it('returns empty array for no phases', () => {
    expect(generateWeekPlans([])).toEqual([]);
  });

  it('week numbers are continuous', () => {
    const weeks = generateWeekPlans(samplePhases);
    for (let i = 0; i < weeks.length; i++) {
      expect(weeks[i].weekNumber).toBe(i + 1);
    }
  });

  it('each week has valid start and end dates', () => {
    const weeks = generateWeekPlans(samplePhases);
    weeks.forEach((w) => {
      expect(w.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(w.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(w.startDate <= w.endDate).toBe(true);
    });
  });

  it('initializes with zero practices and empty plan IDs', () => {
    const weeks = generateWeekPlans(samplePhases);
    weeks.forEach((w) => {
      expect(w.practiceCount).toBe(0);
      expect(w.practicePlanIds).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// DATA LAYER PINS (04 §H tests-FIRST mandate) — pin the CURRENT Firestore
// behavior of all six data functions; the Phase H swap lands under these.
// ---------------------------------------------------------------------------

describe('subscribeSeasonPlans (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries season_plans scoped to the coach, newest season first', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeSeasonPlans('coach-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'season_plans');
    expect(firestore.where).toHaveBeenCalledWith('coachId', '==', 'coach-1');
    expect(firestore.orderBy).toHaveBeenCalledWith('startDate', 'desc');
    expect(unsub).toBe(mockUnsub);
  });

  it('maps snapshot docs to {id, ...data}', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());
    const callback = jest.fn();
    subscribeSeasonPlans('coach-1', callback);

    const handler = firestore.onSnapshot.mock.calls[0][1];
    handler({
      docs: [{ id: 'sp-1', data: () => ({ name: 'Fall 2026', coachId: 'coach-1' }) }],
    });

    expect(callback).toHaveBeenCalledWith([{ id: 'sp-1', name: 'Fall 2026', coachId: 'coach-1' }]);
  });
});

describe('createSeasonPlan (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('addDocs the plan verbatim (coachId/coachName ride inside) + stamps both timestamps', async () => {
    const plan = {
      name: 'Fall 2026',
      group: 'Senior',
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      phases: [],
      coachId: 'coach-1',
      coachName: 'Coach Kevin',
    } as any;

    const id = await createSeasonPlan(plan);

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'season_plans');
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload).toEqual(
      expect.objectContaining({ name: 'Fall 2026', coachId: 'coach-1', coachName: 'Coach Kevin' }),
    );
    expect(payload).toHaveProperty('createdAt');
    expect(payload).toHaveProperty('updatedAt');
    expect(id).toBe('new-doc-id');
  });
});

describe('updateSeasonPlan (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates the plan doc and re-stamps updatedAt only', async () => {
    await updateSeasonPlan('sp-1', { name: 'Renamed' } as any);

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'season_plans', 'sp-1');
    const payload = firestore.updateDoc.mock.calls[0][1];
    expect(payload).toEqual(expect.objectContaining({ name: 'Renamed' }));
    expect(payload).toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('createdAt');
  });
});

describe('deleteSeasonPlan (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cascades CLIENT-SIDE: deletes every weeks subdoc, then the plan doc', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [{ id: 'wk-1' }, { id: 'wk-2' }] });

    await deleteSeasonPlan('sp-1');

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'season_plans',
      'sp-1',
      'weeks',
    );
    expect(firestore.deleteDoc).toHaveBeenCalledTimes(3);
    const deletedPaths = firestore.deleteDoc.mock.calls.map((c: any[]) => c[0].path);
    expect(deletedPaths.slice(0, 2)).toEqual([
      'season_plans/sp-1/weeks/wk-1',
      'season_plans/sp-1/weeks/wk-2',
    ]);
    expect(deletedPaths[2]).toBe('season_plans/sp-1');
  });

  it('with zero weeks still deletes the plan doc', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await deleteSeasonPlan('sp-1');

    expect(firestore.deleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('subscribeWeekPlans (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries the weeks subcollection ordered by weekNumber asc', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeWeekPlans('sp-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'season_plans',
      'sp-1',
      'weeks',
    );
    expect(firestore.orderBy).toHaveBeenCalledWith('weekNumber', 'asc');
    expect(unsub).toBe(mockUnsub);
  });

  it('maps snapshot docs to {id, ...data}', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());
    const callback = jest.fn();
    subscribeWeekPlans('sp-1', callback);

    const handler = firestore.onSnapshot.mock.calls[0][1];
    handler({ docs: [{ id: 'wk-1', data: () => ({ weekNumber: 1, phase: 'base' }) }] });

    expect(callback).toHaveBeenCalledWith([{ id: 'wk-1', weekNumber: 1, phase: 'base' }]);
  });
});

describe('upsertWeekPlan (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  const baseWeek: WeekPlan = {
    weekNumber: 3,
    startDate: '2026-09-15',
    endDate: '2026-09-21',
    phase: 'base',
    targetYardage: 20000,
    practiceCount: 0,
    practicePlanIds: [],
  };

  it('is ID-BASED, not weekNumber-based: week WITH id updates that doc, id stripped from payload', async () => {
    const id = await upsertWeekPlan('sp-1', { ...baseWeek, id: 'wk-3' });

    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'season_plans',
      'sp-1',
      'weeks',
      'wk-3',
    );
    const payload = firestore.updateDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('id');
    expect(payload).toEqual(expect.objectContaining({ weekNumber: 3, phase: 'base' }));
    expect(id).toBe('wk-3');
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('week WITHOUT id addDocs verbatim and returns the new id', async () => {
    const id = await upsertWeekPlan('sp-1', { ...baseWeek });

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'season_plans',
      'sp-1',
      'weeks',
    );
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ weekNumber: 3 }),
    );
    expect(id).toBe('new-doc-id');
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('weeks carry NO updatedAt stamp (named no-stamp behavior, preserved by canonical)', async () => {
    await upsertWeekPlan('sp-1', { ...baseWeek, id: 'wk-3' });
    await upsertWeekPlan('sp-1', { ...baseWeek });

    const updatePayload = firestore.updateDoc.mock.calls[0][1];
    const addPayload = firestore.addDoc.mock.calls[0][1];
    expect(updatePayload).not.toHaveProperty('updatedAt');
    expect(addPayload).not.toHaveProperty('updatedAt');
  });
});
