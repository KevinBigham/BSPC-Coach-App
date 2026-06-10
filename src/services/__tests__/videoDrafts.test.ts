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
  updateDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('../../config/supabase', () => {
  const query: Record<string, jest.Mock> & { then: unknown } = {
    insert: jest.fn(() => query),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __notesQuery: query };
});

import { approveVideoDraft, rejectVideoDraft, type VideoDraft } from '../videoDrafts';
import type { Swimmer } from '../../types/firestore.types';

const firestore = require('firebase/firestore');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../config/supabase');
const { supabase, __notesQuery } = supabaseMock;

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

const consentedSwimmer: Swimmer = {
  firstName: 'Jane',
  lastName: 'Doe',
  displayName: 'Jane Doe',
  dateOfBirth: new Date('2012-01-01T00:00:00Z'),
  gender: 'F',
  group: 'Gold',
  active: true,
  strengths: [],
  weaknesses: [],
  techniqueFocusAreas: [],
  goals: [],
  parentContacts: [],
  meetSchedule: [],
  mediaConsent: { granted: true, date: new Date('2026-04-01T00:00:00Z') },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'coach-1',
};

const blockedSwimmer: Swimmer = {
  ...consentedSwimmer,
  mediaConsent: { granted: false, date: new Date('2026-04-01T00:00:00Z') },
};

const assertApproveVideoDraftRequiresRosterContext = () => {
  // @ts-expect-error approveVideoDraft requires a swimmer roster context argument.
  void approveVideoDraft('session-1', makeDraft(), 'coach-1', 'Coach Kevin');
};
void assertApproveVideoDraftRequiresRosterContext;

describe('approveVideoDraft', () => {
  it('marks the draft as approved in Firestore', async () => {
    await approveVideoDraft('session-1', makeDraft(), 'coach-1', 'Coach Kevin', consentedSwimmer);
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'video_sessions/session-1/drafts/draft-1' }),
      expect.objectContaining({ approved: true, reviewedBy: 'coach-1' }),
    );
  });

  it('creates a canonical swimmer_notes row from the draft content', async () => {
    const draft = makeDraft();
    await approveVideoDraft('session-1', draft, 'coach-1', 'Coach Kevin', consentedSwimmer);
    expect(supabase.from).toHaveBeenCalledWith('swimmer_notes');
    expect(__notesQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        swimmer_id: 'sw-1',
        source: 'video_ai',
        coach_id: 'coach-1',
      }),
    );
    const noteData = __notesQuery.insert.mock.calls[0][0];
    expect(noteData).not.toHaveProperty('coachName'); // derived on read
    // video notes carry NO note-side pointer (posted_note_id is draft-side, F)
    expect(noteData).not.toHaveProperty('source_audio_draft_id');
    expect(noteData).not.toHaveProperty('source_voice_note_id');
  });

  it('note content includes observation, diagnosis, and drill', async () => {
    const draft = makeDraft();
    await approveVideoDraft('session-1', draft, 'coach-1', 'Coach Kevin', consentedSwimmer);
    const noteData = __notesQuery.insert.mock.calls[0][0];
    expect(noteData.content).toContain('Elbow drops on recovery');
    expect(noteData.content).toContain('Diagnosis: Shoulder fatigue');
    expect(noteData.content).toContain('Drill: Catch-up drill');
  });

  it('omits empty diagnosis/drill lines', async () => {
    const draft = makeDraft({ diagnosis: '', drillRecommendation: '' });
    await approveVideoDraft('session-1', draft, 'coach-1', 'Coach Kevin', consentedSwimmer);
    const noteData = __notesQuery.insert.mock.calls[0][0];
    expect(noteData.content).not.toContain('Diagnosis:');
    expect(noteData.content).not.toContain('Drill:');
  });

  it('rejects when roster context is present but media consent is missing', async () => {
    await expect(
      approveVideoDraft('session-1', makeDraft(), 'coach-1', 'Coach Kevin', blockedSwimmer),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
    expect(__notesQuery.insert).not.toHaveBeenCalled();
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
