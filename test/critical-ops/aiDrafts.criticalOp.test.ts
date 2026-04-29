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
  addDoc: jest.fn().mockResolvedValue({ id: 'fixture-note-doc' }),
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

import {
  approveDraft,
  rejectDraft,
  approveAllDrafts,
  checkAndCompleteSession,
} from '../../src/services/aiDrafts';
import { buildAIDraft, buildSwimmer, buildMediaConsent } from '../fixtures/coach';

const firestore = require('firebase/firestore');

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
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'swimmers/swim-GO-001/notes' }),
      expect.objectContaining({
        content: payload.observation,
        tags: payload.tags,
        source: 'audio_ai',
        sourceRefId: 'draft-AI-001',
      }),
    );
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

    const noteData = firestore.addDoc.mock.calls[0][1];
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
    expect(firestore.addDoc).not.toHaveBeenCalled();
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
    expect(firestore.addDoc).not.toHaveBeenCalled();
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
    expect(firestore.addDoc).toHaveBeenCalled();
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
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('edge: rejection records the reviewer uid', async () => {
    await rejectDraft('sess-AUD-002', 'draft-AI-099', 'coach-002');
    const call = firestore.updateDoc.mock.calls[0][1];
    expect(call.reviewedBy).toBe('coach-002');
    expect(call.reviewedAt).toBeDefined();
  });
});

describe('aiDrafts.approveAllDrafts (critical op)', () => {
  it('happy path: 4 drafts batch into one commit with set+update per draft', async () => {
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
    expect(mockBatch.set).toHaveBeenCalledTimes(4);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('edge: 401 drafts chunk into two commits at the 400-item limit', async () => {
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
    expect(mockBatch.set).toHaveBeenCalledTimes(401);
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
    expect(mockBatch.set).not.toHaveBeenCalled();
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
