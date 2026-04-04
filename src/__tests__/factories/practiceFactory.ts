import type { PracticePlan, PracticePlanSet, PracticePlanItem } from '../../types/firestore.types';

let counter = 0;

export function buildPracticeItem(overrides: Partial<PracticePlanItem> = {}): PracticePlanItem {
  counter++;
  return {
    order: 0,
    reps: 4,
    distance: 100,
    stroke: 'Free',
    description: `Test item ${counter}`,
    interval: '1:30',
    focusPoints: [],
    ...overrides,
  };
}

export function buildPracticeSet(overrides: Partial<PracticePlanSet> = {}): PracticePlanSet {
  counter++;
  return {
    order: 0,
    name: `Set ${counter}`,
    category: 'Main Set',
    description: '',
    items: [buildPracticeItem()],
    ...overrides,
  };
}

export function buildPracticePlan(
  overrides: Partial<PracticePlan & { id: string }> = {},
): PracticePlan & { id: string } {
  counter++;
  return {
    id: `plan-${counter}`,
    title: `Practice Plan ${counter}`,
    description: 'Test practice plan',
    group: 'Gold',
    coachId: 'test-coach-uid',
    coachName: 'Coach Test',
    isTemplate: false,
    totalDuration: 90,
    sets: [
      buildPracticeSet({ category: 'Warmup', name: 'Warmup' }),
      buildPracticeSet({ category: 'Main Set', name: 'Main Set' }),
      buildPracticeSet({ category: 'Cooldown', name: 'Cooldown' }),
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function resetPracticeFactory() {
  counter = 0;
}
