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
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'fixture-note-doc' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
}));

import { approveVideoDraft, rejectVideoDraft } from '../../src/services/videoDrafts';
import { buildVideoDraft, buildSwimmer, buildMediaConsent } from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('videoDrafts.approveVideoDraft (critical op)', () => {
  it('happy path: flips draft to approved and writes a video_ai swimmer note', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const draft = buildVideoDraft({ swimmer, index: 1 });

    await approveVideoDraft('sess-VID-001', draft as never, 'coach-001', 'Coach One');

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'video_sessions/sess-VID-001/drafts/draft-VID-001' }),
      expect.objectContaining({ approved: true, reviewedBy: 'coach-001' }),
    );
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'swimmers/swim-GO-001/notes' }),
      expect.objectContaining({
        source: 'video_ai',
        coachId: 'coach-001',
        coachName: 'Coach One',
      }),
    );
  });

  it('edge: note content joins observation, diagnosis, and drill with line breaks', async () => {
    const swimmer = buildSwimmer({ index: 2, group: 'Gold' });
    const draft = buildVideoDraft({
      swimmer,
      index: 2,
      observation: 'Late catch',
      diagnosis: 'Dropped elbow',
      drillRecommendation: 'Sculling 4x25',
    });

    await approveVideoDraft('sess-VID-001', draft as never, 'coach-001', 'Coach One');

    const noteData = firestore.addDoc.mock.calls[0][1];
    expect(noteData.content).toContain('Late catch');
    expect(noteData.content).toContain('Diagnosis: Dropped elbow');
    expect(noteData.content).toContain('Drill: Sculling 4x25');
  });

  it('edge: omits empty diagnosis/drill lines from the joined note', async () => {
    const swimmer = buildSwimmer({ index: 3, group: 'Gold' });
    const draft = buildVideoDraft({
      swimmer,
      index: 3,
      observation: 'Strong kick',
      diagnosis: '',
      drillRecommendation: '',
    });

    await approveVideoDraft('sess-VID-001', draft as never, 'coach-001', 'Coach One');

    const noteData = firestore.addDoc.mock.calls[0][1];
    expect(noteData.content).toBe('Strong kick');
    expect(noteData.content).not.toContain('Diagnosis:');
    expect(noteData.content).not.toContain('Drill:');
  });

  // ---------------------------------------------------------------------------
  // BUG #4 — approveVideoDraft must enforce media consent at the service boundary
  // ---------------------------------------------------------------------------

  it('failure mode (BUG #4): rejects when supplied swimmer has mediaConsent.granted=false', async () => {
    const swimmer = buildSwimmer({
      index: 4,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: false }) },
    });
    const draft = buildVideoDraft({ swimmer, index: 4 });

    await expect(
      approveVideoDraft('sess-VID-001', draft as never, 'coach-001', 'Coach One', swimmer),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('failure mode (BUG #4): rejects when supplied swimmer has doNotPhotograph=true', async () => {
    const swimmer = buildSwimmer({
      index: 5,
      group: 'Gold',
      overrides: {
        doNotPhotograph: true,
        mediaConsent: buildMediaConsent({ granted: true }),
      },
    });
    const draft = buildVideoDraft({ swimmer, index: 5 });

    await expect(
      approveVideoDraft('sess-VID-001', draft as never, 'coach-001', 'Coach One', swimmer),
    ).rejects.toThrow(/do_not_photograph|cannot tag/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });
});

describe('videoDrafts.rejectVideoDraft (critical op)', () => {
  it('happy path: flips draft to approved=false', async () => {
    await rejectVideoDraft('sess-VID-001', 'draft-VID-001', 'coach-001');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'video_sessions/sess-VID-001/drafts/draft-VID-001' }),
      expect.objectContaining({ approved: false, reviewedBy: 'coach-001' }),
    );
  });

  it('failure-shape: rejecting MUST NOT post a swimmer note', async () => {
    await rejectVideoDraft('sess-VID-001', 'draft-VID-001', 'coach-001');
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('edge: rejection records reviewer uid', async () => {
    await rejectVideoDraft('sess-VID-002', 'draft-VID-099', 'coach-007');
    const call = firestore.updateDoc.mock.calls[0][1];
    expect(call.reviewedBy).toBe('coach-007');
    expect(call.reviewedAt).toBeDefined();
  });
});
