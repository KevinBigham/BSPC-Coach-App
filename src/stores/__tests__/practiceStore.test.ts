jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

import { usePracticeStore } from '../practiceStore';
import type { PracticePlan, PracticePlanSet } from '../../types/firestore.types';
import type { SetCategory } from '../../config/constants';

describe('practiceStore', () => {
  beforeEach(() => {
    usePracticeStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = usePracticeStore.getState();
    expect(state.title).toBe('');
    expect(state.description).toBe('');
    expect(state.group).toBeNull();
    expect(state.isTemplate).toBe(false);
    expect(state.date).toBeNull();
    expect(state.sets).toEqual([]);
    expect(state._history).toEqual([[]]);
    expect(state._historyIndex).toBe(0);
  });

  // --- Metadata actions ---

  it('setTitle updates title', () => {
    usePracticeStore.getState().setTitle('Morning Practice');
    expect(usePracticeStore.getState().title).toBe('Morning Practice');
  });

  it('setDescription updates description', () => {
    usePracticeStore.getState().setDescription('Focus on turns');
    expect(usePracticeStore.getState().description).toBe('Focus on turns');
  });

  it('setGroup and setDate update metadata', () => {
    usePracticeStore.getState().setGroup('Gold');
    usePracticeStore.getState().setDate('2026-04-04');
    expect(usePracticeStore.getState().group).toBe('Gold');
    expect(usePracticeStore.getState().date).toBe('2026-04-04');
  });

  // --- Set actions ---

  it('addSet creates a new set with one default item', () => {
    usePracticeStore.getState().addSet('Warm-Up' as SetCategory);
    const sets = usePracticeStore.getState().sets;
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe('Warm-Up');
    expect(sets[0].category).toBe('Warm-Up');
    expect(sets[0].order).toBe(0);
    expect(sets[0].items).toHaveLength(1);
    expect(sets[0].items[0].reps).toBe(1);
    expect(sets[0].items[0].distance).toBe(100);
    expect(sets[0].items[0].stroke).toBe('Freestyle');
  });

  it('removeSet removes the set and reorders remaining', () => {
    usePracticeStore.getState().addSet('Warm-Up' as SetCategory);
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().addSet('Cool Down' as SetCategory);

    usePracticeStore.getState().removeSet(1);

    const sets = usePracticeStore.getState().sets;
    expect(sets).toHaveLength(2);
    expect(sets[0].name).toBe('Warm-Up');
    expect(sets[0].order).toBe(0);
    expect(sets[1].name).toBe('Cool Down');
    expect(sets[1].order).toBe(1);
  });

  it('updateSetName changes the set name', () => {
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().updateSetName(0, 'Sprint Set');
    expect(usePracticeStore.getState().sets[0].name).toBe('Sprint Set');
  });

  it('updateSetDescription changes the set description', () => {
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().updateSetDescription(0, 'Focus on speed');
    expect(usePracticeStore.getState().sets[0].description).toBe('Focus on speed');
  });

  it('reorderSets moves a set and updates order fields', () => {
    usePracticeStore.getState().addSet('Warm-Up' as SetCategory);
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().addSet('Cool Down' as SetCategory);

    usePracticeStore.getState().reorderSets(2, 0);

    const sets = usePracticeStore.getState().sets;
    expect(sets[0].name).toBe('Cool Down');
    expect(sets[0].order).toBe(0);
    expect(sets[1].name).toBe('Warm-Up');
    expect(sets[1].order).toBe(1);
    expect(sets[2].name).toBe('Main Set');
    expect(sets[2].order).toBe(2);
  });

  // --- Item actions ---

  it('addItem adds an item to the specified set', () => {
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().addItem(0);

    const items = usePracticeStore.getState().sets[0].items;
    expect(items).toHaveLength(2);
    expect(items[1].order).toBe(1);
  });

  it('removeItem removes from the set and reorders', () => {
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().addItem(0);
    usePracticeStore.getState().addItem(0);

    usePracticeStore.getState().removeItem(0, 1);

    const items = usePracticeStore.getState().sets[0].items;
    expect(items).toHaveLength(2);
    expect(items[0].order).toBe(0);
    expect(items[1].order).toBe(1);
  });

  it('updateItem merges partial data into the item', () => {
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().updateItem(0, 0, { reps: 4, distance: 200, stroke: 'Butterfly' });

    const item = usePracticeStore.getState().sets[0].items[0];
    expect(item.reps).toBe(4);
    expect(item.distance).toBe(200);
    expect(item.stroke).toBe('Butterfly');
  });

  it('reorderItems moves an item within a set', () => {
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().addItem(0);
    usePracticeStore.getState().addItem(0);

    // Mark items so we can track them
    usePracticeStore.getState().updateItem(0, 0, { stroke: 'Backstroke' });
    usePracticeStore.getState().updateItem(0, 1, { stroke: 'Butterfly' });
    usePracticeStore.getState().updateItem(0, 2, { stroke: 'Breaststroke' });

    usePracticeStore.getState().reorderItems(0, 2, 0);

    const items = usePracticeStore.getState().sets[0].items;
    expect(items[0].stroke).toBe('Breaststroke');
    expect(items[0].order).toBe(0);
    expect(items[1].stroke).toBe('Backstroke');
    expect(items[1].order).toBe(1);
    expect(items[2].stroke).toBe('Butterfly');
    expect(items[2].order).toBe(2);
  });

  // --- Undo / Redo ---

  it('undo reverts to previous sets state', () => {
    usePracticeStore.getState().addSet('Warm-Up' as SetCategory);
    usePracticeStore.getState().addSet('Main Set' as SetCategory);

    expect(usePracticeStore.getState().sets).toHaveLength(2);
    expect(usePracticeStore.getState().canUndo()).toBe(true);

    usePracticeStore.getState().undo();
    expect(usePracticeStore.getState().sets).toHaveLength(1);
    expect(usePracticeStore.getState().sets[0].name).toBe('Warm-Up');
  });

  it('redo restores the undone state', () => {
    usePracticeStore.getState().addSet('Warm-Up' as SetCategory);
    usePracticeStore.getState().addSet('Main Set' as SetCategory);

    usePracticeStore.getState().undo();
    expect(usePracticeStore.getState().canRedo()).toBe(true);

    usePracticeStore.getState().redo();
    expect(usePracticeStore.getState().sets).toHaveLength(2);
  });

  it('undo does nothing at beginning of history', () => {
    expect(usePracticeStore.getState().canUndo()).toBe(false);
    usePracticeStore.getState().undo();
    expect(usePracticeStore.getState().sets).toEqual([]);
  });

  it('redo does nothing at end of history', () => {
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    expect(usePracticeStore.getState().canRedo()).toBe(false);
    usePracticeStore.getState().redo();
    expect(usePracticeStore.getState().sets).toHaveLength(1);
  });

  it('new action after undo truncates future history', () => {
    usePracticeStore.getState().addSet('Warm-Up' as SetCategory);
    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().addSet('Cool Down' as SetCategory);

    usePracticeStore.getState().undo();
    usePracticeStore.getState().undo();

    // Now add a different set — should truncate future
    usePracticeStore.getState().addSet('Sprint' as SetCategory);

    expect(usePracticeStore.getState().canRedo()).toBe(false);
    expect(usePracticeStore.getState().sets).toHaveLength(2);
  });

  // --- loadPlan ---

  it('loadPlan populates state from a PracticePlan', () => {
    const plan: PracticePlan = {
      title: 'Test Plan',
      description: 'A test',
      group: 'Gold',
      isTemplate: true,
      date: '2026-04-04',
      coachId: 'c1',
      coachName: 'Coach K',
      totalDuration: 60,
      sets: [
        {
          order: 0,
          name: 'Warm-Up',
          category: 'Warm-Up' as SetCategory,
          items: [{ order: 0, reps: 1, distance: 400, stroke: 'Freestyle', focusPoints: [] }],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    usePracticeStore.getState().loadPlan(plan);

    const state = usePracticeStore.getState();
    expect(state.title).toBe('Test Plan');
    expect(state.description).toBe('A test');
    expect(state.group).toBe('Gold');
    expect(state.isTemplate).toBe(true);
    expect(state.date).toBe('2026-04-04');
    expect(state.sets).toHaveLength(1);
    expect(state._historyIndex).toBe(0);
  });

  // --- reset ---

  it('reset clears all state back to defaults', () => {
    usePracticeStore.getState().setTitle('Dirty');
    usePracticeStore.getState().addSet('Main Set' as SetCategory);

    usePracticeStore.getState().reset();

    const state = usePracticeStore.getState();
    expect(state.title).toBe('');
    expect(state.sets).toEqual([]);
    expect(state._history).toEqual([[]]);
  });

  // --- toPlan ---

  it('toPlan produces a PracticePlan-like object', () => {
    usePracticeStore.getState().setTitle('Morning Workout');
    usePracticeStore.getState().setGroup('Gold');
    usePracticeStore.getState().addSet('Warm-Up' as SetCategory);

    const plan = usePracticeStore.getState().toPlan('coach1', 'Coach K');
    expect(plan.title).toBe('Morning Workout');
    expect(plan.coachId).toBe('coach1');
    expect(plan.coachName).toBe('Coach K');
    expect(plan.group).toBe('Gold');
    expect(plan.sets).toHaveLength(1);
  });

  it('toPlan uses "Untitled Practice" when title is empty', () => {
    const plan = usePracticeStore.getState().toPlan('c1', 'Coach');
    expect(plan.title).toBe('Untitled Practice');
  });

  // --- totalYardage ---

  it('totalYardage computes sum of reps * distance across all sets', () => {
    usePracticeStore.getState().addSet('Warm-Up' as SetCategory);
    usePracticeStore.getState().updateItem(0, 0, { reps: 1, distance: 400 });

    usePracticeStore.getState().addSet('Main Set' as SetCategory);
    usePracticeStore.getState().updateItem(1, 0, { reps: 8, distance: 100 });

    // 400 + 800 = 1200
    expect(usePracticeStore.getState().totalYardage()).toBe(1200);
  });

  it('totalYardage returns 0 with no sets', () => {
    expect(usePracticeStore.getState().totalYardage()).toBe(0);
  });
});
