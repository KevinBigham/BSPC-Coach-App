jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-note-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: jest.fn(() => new Date()),
}));

import { approveVideoDraft, rejectVideoDraft, type VideoDraft } from '../videoDrafts';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

const makeDraft = (overrides?: Partial<VideoDraft>): VideoDraft => ({
  id: 'draft-1',
  swimmerId: 'sw-1',
  swimmerName: 'Jane Doe',
  observation: 'Elbow drops on recovery',
  diagnosis: 'Shoulder fatigue',
  drillRecommendation: 'Catch-up drill',
  phase: 'stroke',
  tags: ['technique'] as VideoDraft['tags'],
  confidence: 0.85,
  createdAt: new Date() as unknown as VideoDraft['createdAt'],
  ...overrides,
});

describe('approveVideoDraft', () => {
  it('marks the draft as approved in Firestore', async () => {
    await approveVideoDraft('session-1', makeDraft(), 'coach-1', 'Coach Kevin');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'video_sessions/session-1/drafts/draft-1' }),
      expect.objectContaining({ approved: true, reviewedBy: 'coach-1' }),
    );
  });

  it('creates a swimmer note from the draft content', async () => {
    const draft = makeDraft();
    await approveVideoDraft('session-1', draft, 'coach-1', 'Coach Kevin');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'swimmers/sw-1/notes' }),
      expect.objectContaining({
        source: 'video_ai',
        coachId: 'coach-1',
        coachName: 'Coach Kevin',
      }),
    );
  });

  it('note content includes observation, diagnosis, and drill', async () => {
    const draft = makeDraft();
    await approveVideoDraft('session-1', draft, 'coach-1', 'Coach Kevin');
    const noteData = firestore.addDoc.mock.calls[0][1];
    expect(noteData.content).toContain('Elbow drops on recovery');
    expect(noteData.content).toContain('Diagnosis: Shoulder fatigue');
    expect(noteData.content).toContain('Drill: Catch-up drill');
  });

  it('omits empty diagnosis/drill lines', async () => {
    const draft = makeDraft({ diagnosis: '', drillRecommendation: '' });
    await approveVideoDraft('session-1', draft, 'coach-1', 'Coach Kevin');
    const noteData = firestore.addDoc.mock.calls[0][1];
    expect(noteData.content).not.toContain('Diagnosis:');
    expect(noteData.content).not.toContain('Drill:');
  });
});

describe('rejectVideoDraft', () => {
  it('marks the draft as rejected', async () => {
    await rejectVideoDraft('session-1', 'draft-1', 'coach-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'video_sessions/session-1/drafts/draft-1' }),
      expect.objectContaining({ approved: false, reviewedBy: 'coach-1' }),
    );
  });
});
