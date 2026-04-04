jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

jest.mock('../../services/liveMeet', () => ({}));

import { useLiveMeetStore } from '../liveMeetStore';
import type { LiveEvent, Split } from '../../services/liveMeet';

type LiveEventWithId = LiveEvent & { id: string };
type SplitWithId = Split & { id: string };

function makeSplit(overrides: Partial<SplitWithId> = {}): SplitWithId {
  return {
    id: 'sp1',
    meetId: 'meet1',
    eventId: 'ev1',
    lane: 1,
    splitNumber: 1,
    time: 3000,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<LiveEventWithId> = {}): LiveEventWithId {
  return {
    id: 'ev1',
    meetId: 'meet1',
    eventName: '100 Free',
    eventNumber: 3,
    gender: 'M',
    heatNumber: 1,
    totalHeats: 3,
    status: 'pending',
    ...overrides,
  };
}

describe('liveMeetStore', () => {
  beforeEach(() => {
    useLiveMeetStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useLiveMeetStore.getState();
    expect(state.meetId).toBeNull();
    expect(state.currentEvent).toBeNull();
    expect(state.splits).toEqual([]);
    expect(state.isTimerRunning).toBe(false);
    expect(state.timerStartTime).toBeNull();
    expect(state.elapsedHundredths).toBe(0);
    expect(state.laneAssignments).toEqual({});
  });

  it('setMeetId updates meetId', () => {
    useLiveMeetStore.getState().setMeetId('meet1');
    expect(useLiveMeetStore.getState().meetId).toBe('meet1');
  });

  it('setCurrentEvent sets the event', () => {
    const event = makeEvent();
    useLiveMeetStore.getState().setCurrentEvent(event);
    expect(useLiveMeetStore.getState().currentEvent).toEqual(event);
  });

  it('setSplits populates splits array', () => {
    const splits = [makeSplit({ id: 'sp1' }), makeSplit({ id: 'sp2', lane: 2 })];
    useLiveMeetStore.getState().setSplits(splits);
    expect(useLiveMeetStore.getState().splits).toHaveLength(2);
  });

  it('startTimer sets running state and timestamp', () => {
    const before = Date.now();
    useLiveMeetStore.getState().startTimer();

    const state = useLiveMeetStore.getState();
    expect(state.isTimerRunning).toBe(true);
    expect(state.timerStartTime).toBeGreaterThanOrEqual(before);
    expect(state.elapsedHundredths).toBe(0);
  });

  it('stopTimer stops the timer', () => {
    useLiveMeetStore.getState().startTimer();
    useLiveMeetStore.getState().stopTimer();
    expect(useLiveMeetStore.getState().isTimerRunning).toBe(false);
  });

  it('updateElapsed tracks elapsed hundredths', () => {
    useLiveMeetStore.getState().updateElapsed(4567);
    expect(useLiveMeetStore.getState().elapsedHundredths).toBe(4567);
  });

  it('setLaneAssignment assigns a swimmer to a lane', () => {
    useLiveMeetStore.getState().setLaneAssignment(3, 'sw1', 'Michael Phelps');
    const assignments = useLiveMeetStore.getState().laneAssignments;
    expect(assignments[3]).toEqual({ swimmerId: 'sw1', swimmerName: 'Michael Phelps' });
  });

  it('setLaneAssignment adds to existing assignments', () => {
    useLiveMeetStore.getState().setLaneAssignment(1, 'sw1', 'Swimmer A');
    useLiveMeetStore.getState().setLaneAssignment(2, 'sw2', 'Swimmer B');

    const assignments = useLiveMeetStore.getState().laneAssignments;
    expect(Object.keys(assignments)).toHaveLength(2);
  });

  it('clearLaneAssignments empties all lanes', () => {
    useLiveMeetStore.getState().setLaneAssignment(1, 'sw1', 'A');
    useLiveMeetStore.getState().setLaneAssignment(2, 'sw2', 'B');
    useLiveMeetStore.getState().clearLaneAssignments();

    expect(useLiveMeetStore.getState().laneAssignments).toEqual({});
  });

  it('getSplitsForLane filters by lane number', () => {
    useLiveMeetStore
      .getState()
      .setSplits([
        makeSplit({ id: 'sp1', lane: 1, splitNumber: 1 }),
        makeSplit({ id: 'sp2', lane: 2, splitNumber: 1 }),
        makeSplit({ id: 'sp3', lane: 1, splitNumber: 2 }),
      ]);

    const lane1 = useLiveMeetStore.getState().getSplitsForLane(1);
    expect(lane1).toHaveLength(2);
    expect(lane1.every((s) => s.lane === 1)).toBe(true);
  });

  it('getLatestSplitForLane returns highest splitNumber for lane', () => {
    useLiveMeetStore
      .getState()
      .setSplits([
        makeSplit({ id: 'sp1', lane: 1, splitNumber: 1, time: 3000 }),
        makeSplit({ id: 'sp2', lane: 1, splitNumber: 3, time: 9000 }),
        makeSplit({ id: 'sp3', lane: 1, splitNumber: 2, time: 6000 }),
      ]);

    const latest = useLiveMeetStore.getState().getLatestSplitForLane(1);
    expect(latest?.splitNumber).toBe(3);
    expect(latest?.time).toBe(9000);
  });

  it('getLatestSplitForLane returns null for empty lane', () => {
    expect(useLiveMeetStore.getState().getLatestSplitForLane(5)).toBeNull();
  });

  it('reset clears everything', () => {
    useLiveMeetStore.getState().setMeetId('meet1');
    useLiveMeetStore.getState().startTimer();
    useLiveMeetStore.getState().setLaneAssignment(1, 'sw1', 'A');
    useLiveMeetStore.getState().setSplits([makeSplit()]);

    useLiveMeetStore.getState().reset();

    const state = useLiveMeetStore.getState();
    expect(state.meetId).toBeNull();
    expect(state.isTimerRunning).toBe(false);
    expect(state.splits).toEqual([]);
    expect(state.laneAssignments).toEqual({});
  });
});
