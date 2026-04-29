import { act, renderHook } from '@testing-library/react-native';
import type { GroupNote } from '../../services/groupNotes';
import type { PracticePlan } from '../../types/firestore.types';
import { usePracticeData } from '../usePracticeData';

const mockSubscribePracticePlans = jest.fn();
const mockUseAuth = jest.fn((): { coach: { uid: string } | null } => ({
  coach: { uid: 'coach-1' },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../services/practicePlans', () => ({
  subscribePracticePlans: (...args: Parameters<typeof mockSubscribePracticePlans>) =>
    mockSubscribePracticePlans(...args),
}));

const mockSubscribeGroupNotes = jest.fn();

jest.mock('../../services/groupNotes', () => ({
  subscribeGroupNotes: (...args: Parameters<typeof mockSubscribeGroupNotes>) =>
    mockSubscribeGroupNotes(...args),
}));

type PlanWithId = PracticePlan & { id: string };
type GroupNoteWithId = GroupNote & { id: string };
type PracticePlansCallback = (plans: PlanWithId[]) => void;
type GroupNotesCallback = (notes: GroupNoteWithId[]) => void;

const unsubPracticePlans = jest.fn();
const unsubGroupNotes = jest.fn();

let practicePlansCallback: PracticePlansCallback;
let groupNotesCallback: GroupNotesCallback;

function makePlan(id: string, title: string, isTemplate = false): PlanWithId {
  return {
    id,
    title,
    description: '',
    group: 'Gold',
    isTemplate,
    coachId: 'coach-1',
    coachName: 'Coach One',
    totalDuration: 0,
    sets: [],
    createdAt: new Date('2026-04-08T12:00:00Z'),
    updatedAt: new Date('2026-04-08T12:00:00Z'),
  };
}

function makeGroupNote(id: string, content: string): GroupNoteWithId {
  return {
    id,
    content,
    tags: ['technique'],
    group: 'Gold',
    practiceDate: '2026-04-08',
    coachId: 'coach-1',
    coachName: 'Coach One',
    createdAt: new Date('2026-04-08T12:00:00Z'),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ coach: { uid: 'coach-1' } });
  mockSubscribePracticePlans.mockImplementation((callback: PracticePlansCallback) => {
    practicePlansCallback = callback;
    return unsubPracticePlans;
  });
  mockSubscribeGroupNotes.mockImplementation((_group: null, callback: GroupNotesCallback) => {
    groupNotesCallback = callback;
    return unsubGroupNotes;
  });
});

describe('usePracticeData', () => {
  it('subscribes to practice plans with the existing max limit and clears loading on data', () => {
    const { result } = renderHook(() => usePracticeData());
    const plans = [makePlan('plan-1', 'Sprint Practice'), makePlan('plan-2', 'Kick Set', true)];

    expect(result.current.loading).toBe(true);
    expect(mockSubscribePracticePlans).toHaveBeenCalledWith(expect.any(Function), {
      coachId: 'coach-1',
      max: 50,
    });

    act(() => {
      practicePlansCallback(plans);
    });

    expect(result.current.plans).toEqual(plans);
    expect(result.current.loading).toBe(false);
  });

  it('subscribes to all group notes with the current null group filter', () => {
    const { result } = renderHook(() => usePracticeData());
    const notes = [makeGroupNote('note-1', 'Watch starts')];

    act(() => {
      groupNotesCallback(notes);
    });

    expect(mockSubscribeGroupNotes).toHaveBeenCalledWith(null, expect.any(Function));
    expect(result.current.groupNotes).toEqual(notes);
  });

  it('keeps loading true when only group notes have resolved', () => {
    const { result } = renderHook(() => usePracticeData());

    act(() => {
      groupNotesCallback([makeGroupNote('note-1', 'Distance lane held pace')]);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      practicePlansCallback([]);
    });

    expect(result.current.loading).toBe(false);
  });

  it('cleans up both subscriptions on unmount', () => {
    const { unmount } = renderHook(() => usePracticeData());

    unmount();

    expect(unsubPracticePlans).toHaveBeenCalledTimes(1);
    expect(unsubGroupNotes).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe to private practice plans without a coach id', () => {
    mockUseAuth.mockReturnValue({ coach: null });

    renderHook(() => usePracticeData());

    expect(mockSubscribePracticePlans).not.toHaveBeenCalled();
  });
});
