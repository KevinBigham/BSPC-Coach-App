// Test only the pure utility functions from seasonPlanning
// The Firebase CRUD functions are tested through the store tests

// Must mock firebase modules before importing anything that uses them
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock('../../config/firebase', () => ({
  db: {},
}));

import {
  calculateSeasonYardage,
  calculateTaperProgress,
  getCurrentPhase,
  generateWeekPlans,
} from '../seasonPlanning';
import type { SeasonPhase } from '../../types/firestore.types';

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
