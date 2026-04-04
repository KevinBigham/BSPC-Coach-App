jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

import { useVideoStore } from '../videoStore';
import type { VideoSession } from '../../types/firestore.types';

type VideoSessionWithId = VideoSession & { id: string };

function makeSession(overrides: Partial<VideoSessionWithId> = {}): VideoSessionWithId {
  return {
    id: 'vs1',
    coachId: 'c1',
    coachName: 'Coach K',
    storagePath: 'videos/test.mp4',
    duration: 120,
    practiceDate: '2026-04-04',
    taggedSwimmerIds: [],
    status: 'uploaded',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('videoStore', () => {
  beforeEach(() => {
    useVideoStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useVideoStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.selectedSession).toBeNull();
    expect(state.uploadProgress).toBe(0);
  });

  it('setSessions populates the sessions array', () => {
    const sessions = [makeSession({ id: 'vs1' }), makeSession({ id: 'vs2' })];
    useVideoStore.getState().setSessions(sessions);
    expect(useVideoStore.getState().sessions).toHaveLength(2);
  });

  it('setSelectedSession sets the selected session', () => {
    const session = makeSession();
    useVideoStore.getState().setSelectedSession(session);
    expect(useVideoStore.getState().selectedSession).toEqual(session);
  });

  it('setSelectedSession accepts null', () => {
    useVideoStore.getState().setSelectedSession(makeSession());
    useVideoStore.getState().setSelectedSession(null);
    expect(useVideoStore.getState().selectedSession).toBeNull();
  });

  it('setUploadProgress updates progress value', () => {
    useVideoStore.getState().setUploadProgress(0.5);
    expect(useVideoStore.getState().uploadProgress).toBe(0.5);
  });

  it('setUploadProgress handles boundary values', () => {
    useVideoStore.getState().setUploadProgress(0);
    expect(useVideoStore.getState().uploadProgress).toBe(0);

    useVideoStore.getState().setUploadProgress(1);
    expect(useVideoStore.getState().uploadProgress).toBe(1);
  });

  it('reset clears sessions, selectedSession, and progress', () => {
    useVideoStore.getState().setSessions([makeSession()]);
    useVideoStore.getState().setSelectedSession(makeSession());
    useVideoStore.getState().setUploadProgress(0.75);

    useVideoStore.getState().reset();

    const state = useVideoStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.selectedSession).toBeNull();
    expect(state.uploadProgress).toBe(0);
  });

  it('setSessions replaces previous sessions', () => {
    useVideoStore.getState().setSessions([makeSession({ id: 'vs1' })]);
    useVideoStore.getState().setSessions([makeSession({ id: 'vs2' }), makeSession({ id: 'vs3' })]);

    const sessions = useVideoStore.getState().sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('vs2');
  });
});
