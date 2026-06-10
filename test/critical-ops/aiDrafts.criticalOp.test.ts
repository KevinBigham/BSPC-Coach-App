// Phase E split: approved drafts post canonical swimmer_notes rows (typed
// source_audio_draft_id pointer, no coachName denorm); the draft documents
// themselves stay on Firestore until Phase F. The BUG #4 media-consent
// assertions are unchanged word-for-word.
jest.mock('../../src/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'coach-001' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
  })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/config/supabase', () => {
  const query: Record<string, jest.Mock> & { then: unknown } = {
    insert: jest.fn(() => query),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __notesQuery: query };
});

import {
  approveDraft,
  rejectDraft,
  approveAllDrafts,
  checkAndCompleteSession,
} from '../../src/services/aiDrafts';
import { buildAIDraft, buildSwimmer, buildMediaConsent } from '../fixtures/coach';

const firestore = require('firebase/firestore');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../src/config/supabase');
const { __notesQuery } = supabaseMock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('aiDrafts.approveDraft (critical op)', () => {
  it('happy path: flips draft to approved and writes a swimmer note', async () => {
    const swimmer = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const draft = buildAIDraft({ swimmer, index: 1 });
    const { id, createdAt: _c, ...payload } = draft;

    await approveDraft(
      'sess-AUD-001',
      id,
      payload as never,
      'coach-001',
      undefined,
      undefined,
      swimmer,
    );

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio_sessions/sess-AUD-001/drafts/draft-AI-001' }),
      expect.objectContaining({ approved: true, reviewedBy: 'coach-001' }),
    );
    expect(__notesQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        swimmer_id: 'swim-GO-001',
        content: payload.observation,
        tags: payload.tags,
        source: 'audio_ai',
        source_audio_draft_id: 'draft-AI-001',
        coach_id: 'coach-001',
      }),
    );
    const noteData = __notesQuery.insert.mock.calls[0][0];
    expect(noteData).not.toHaveProperty('coachName'); // derived on read
    expect(noteData).not.toHaveProperty('sourceRefId'); // typed pointer now
  });

  it('edge: edited content and tags override the draft values', async () => {
    const swimmer = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const draft = buildAIDraft({ swimmer, index: 2 });
    const { id, createdAt: _c, ...payload } = draft;

    await approveDraft(
      'sess-AUD-001',
      id,
      payload as never,
      'coach-001',
      'Edited observation',
      ['speed'],
      swimmer,
    );

    const noteData = __notesQuery.insert.mock.calls[0][0];
    expect(noteData.content).toBe('Edited observation');
    expect(noteData.tags).toEqual(['speed']);
  });

  // ---------------------------------------------------------------------------
  // BUG #4 — approveDraft must enforce media consent at the service boundary
  // ---------------------------------------------------------------------------

  it('failure mode (BUG #4): rejects when supplied swimmer has mediaConsent.granted=false', async () => {
    const swimmer = buildSwimmer({
      index: 3,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: false }) },
    });
    const draft = buildAIDraft({ swimmer, index: 3 });
    const { id, createdAt: _c, ...payload } = draft;

    await expect(
      approveDraft(
        'sess-AUD-001',
        id,
        payload as never,
        'coach-001',
        undefined,
        undefined,
        swimmer,
      ),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(__notesQuery.insert).not.toHaveBeenCalled();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('failure mode (BUG #4): rejects when supplied swimmer has doNotPhotograph=true even with granted consent', async () => {
    const swimmer = buildSwimmer({
      index: 4,
      group: 'Gold',
      overrides: {
        doNotPhotograph: true,
        mediaConsent: buildMediaConsent({ granted: true }),
      },
    });
    const draft = buildAIDraft({ swimmer, index: 4 });
    const { id, createdAt: _c, ...payload } = draft;

    await expect(
      approveDraft(
        'sess-AUD-001',
        id,
        payload as never,
        'coach-001',
        undefined,
        undefined,
        swimmer,
      ),
    ).rejects.toThrow(/do_not_photograph|cannot tag/i);
    expect(__notesQuery.insert).not.toHaveBeenCalled();
  });

  it('happy path with roster: passes through when supplied swimmer is consented', async () => {
    const swimmer = buildSwimmer({
      index: 5,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const draft = buildAIDraft({ swimmer, index: 5 });
    const { id, createdAt: _c, ...payload } = draft;

    await expect(
      approveDraft(
        'sess-AUD-001',
        id,
        payload as never,
        'coach-001',
        undefined,
        undefined,
        swimmer,
      ),
    ).resolves.toBeUndefined();
    expect(__notesQuery.insert).toHaveBeenCalled();
  });
});

describe('aiDrafts.rejectDraft (critical op)', () => {
  it('happy path: flips draft to approved=false', async () => {
    await rejectDraft('sess-AUD-001', 'draft-AI-001', 'coach-001');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio_sessions/sess-AUD-001/drafts/draft-AI-001' }),
      expect.objectContaining({ approved: false, reviewedBy: 'coach-001' }),
    );
  });

  it('failure-shape: rejecting MUST NOT post a swimmer note', async () => {
    await rejectDraft('sess-AUD-001', 'draft-AI-001', 'coach-001');
    expect(__notesQuery.insert).not.toHaveBeenCalled();
  });

  it('edge: rejection records the reviewer uid', async () => {
    await rejectDraft('sess-AUD-002', 'draft-AI-099', 'coach-002');
    const call = firestore.updateDoc.mock.calls[0][1];
    expect(call.reviewedBy).toBe('coach-002');
    expect(call.reviewedAt).toBeDefined();
  });
});

describe('aiDrafts.approveAllDrafts (critical op)', () => {
  it('happy path: 4 drafts — one draft-update batch commit + one canonical notes insert', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const swimmers = [1, 2, 3, 4].map((i) =>
      buildSwimmer({
        index: i,
        group: 'Gold',
        overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
      }),
    );
    const drafts = swimmers.map((swimmer, i) => {
      const d = buildAIDraft({ swimmer, index: i + 1 });
      return { ...d, sessionId: 'sess-AUD-001' };
    });
    const swimmersById = new Map(swimmers.map((swimmer) => [swimmer.id, swimmer]));

    const count = await approveAllDrafts(drafts as never, 'coach-001', 'Coach One', swimmersById);

    expect(count).toBe(4);
    expect(mockBatch.update).toHaveBeenCalledTimes(4);
    // notes no longer ride the Firestore batch — one swimmer_notes insert
    expect(mockBatch.set).not.toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(__notesQuery.insert).toHaveBeenCalledTimes(1);
    expect(__notesQuery.insert.mock.calls[0][0]).toHaveLength(4);
  });

  it('edge: 401 drafts chunk into two commits + two note inserts at the 400-item limit', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const swimmers = Array.from({ length: 401 }, (_, i) =>
      buildSwimmer({
        index: i + 1,
        group: 'Diamond',
        overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
      }),
    );
    const drafts = swimmers.map((swimmer, i) => {
      const d = buildAIDraft({ swimmer, index: i + 1 });
      return { ...d, sessionId: 'sess-AUD-001' };
    });
    const swimmersById = new Map(swimmers.map((swimmer) => [swimmer.id, swimmer]));

    const count = await approveAllDrafts(drafts as never, 'coach-001', 'Coach One', swimmersById);

    expect(count).toBe(401);
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
    expect(__notesQuery.insert).toHaveBeenCalledTimes(2);
    expect(__notesQuery.insert.mock.calls[0][0]).toHaveLength(400);
    expect(__notesQuery.insert.mock.calls[1][0]).toHaveLength(1);
  });

  it('failure mode (BUG #4): rejects without committing when one tagged swimmer lacks consent', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const blocked = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: false }) },
    });

    const drafts = [consented, blocked].map((swimmer, i) => {
      const d = buildAIDraft({ swimmer, index: i + 1 });
      return { ...d, sessionId: 'sess-AUD-001' };
    });

    const swimmersById = new Map([
      [consented.id, consented],
      [blocked.id, blocked],
    ]);

    await expect(
      approveAllDrafts(drafts as never, 'coach-001', 'Coach One', swimmersById),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(__notesQuery.insert).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

describe('aiDrafts.checkAndCompleteSession (critical op)', () => {
  it('happy path: marks session posted when every draft is reviewed', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [{ data: () => ({ approved: true }) }, { data: () => ({ approved: false }) }],
    });
    await checkAndCompleteSession('sess-AUD-001');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio_sessions/sess-AUD-001' }),
      expect.objectContaining({ status: 'posted' }),
    );
  });

  it('edge: does NOT transition when any draft is still pending (approved undefined)', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [{ data: () => ({ approved: true }) }, { data: () => ({ approved: undefined }) }],
    });
    await checkAndCompleteSession('sess-AUD-001');
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('failure-shape: does NOT transition when there are zero drafts', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });
    await checkAndCompleteSession('sess-AUD-001');
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});
