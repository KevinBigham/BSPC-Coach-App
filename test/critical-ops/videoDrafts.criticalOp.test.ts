// Phase F: re-pointed at the atomic approve_session_draft RPC (D-F6) — the
// Firestore draft-update half died with the subcollection. BUG #4
// media-consent assertions unchanged word-for-word; every rejection still
// proves NO write happened (target moved updateDoc/insert -> rpc).
jest.mock('../../src/config/supabase', () => {
  const query: Record<string, jest.Mock> & { then: unknown } = {
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    eq: jest.fn(() => query),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  const supabase = {
    from: jest.fn(() => query),
    rpc: jest.fn(() => Promise.resolve({ data: 'note-uuid-1', error: null })),
  };
  return { supabase, __query: query };
});

import { approveVideoDraft, rejectVideoDraft } from '../../src/services/videoDrafts';
import { buildVideoDraft, buildSwimmer, buildMediaConsent } from '../fixtures/coach';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../src/config/supabase');
const { supabase, __query } = supabaseMock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('videoDrafts.approveVideoDraft (critical op)', () => {
  it('happy path: one atomic RPC carries the video_ai approve (note + review-stamp together)', async () => {
    const swimmer = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const draft = buildVideoDraft({ swimmer, index: 1 });

    await approveVideoDraft('sess-VID-001', draft as never, 'coach-001', 'Coach One', swimmer);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'approve_session_draft',
      expect.objectContaining({
        p_kind: 'video',
        p_draft_id: 'draft-VID-001',
        p_coach_id: 'coach-001',
      }),
    );
  });

  it('edge: note content joins observation, diagnosis, and drill with line breaks', async () => {
    const swimmer = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const draft = buildVideoDraft({
      swimmer,
      index: 2,
      observation: 'Late catch',
      diagnosis: 'Dropped elbow',
      drillRecommendation: 'Sculling 4x25',
    });

    await approveVideoDraft('sess-VID-001', draft as never, 'coach-001', 'Coach One', swimmer);

    const content = supabase.rpc.mock.calls[0][1].p_content;
    expect(content).toContain('Late catch');
    expect(content).toContain('Diagnosis: Dropped elbow');
    expect(content).toContain('Drill: Sculling 4x25');
  });

  it('edge: omits empty diagnosis/drill lines from the joined note', async () => {
    const swimmer = buildSwimmer({
      index: 3,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const draft = buildVideoDraft({
      swimmer,
      index: 3,
      observation: 'Strong kick',
      diagnosis: '',
      drillRecommendation: '',
    });

    await approveVideoDraft('sess-VID-001', draft as never, 'coach-001', 'Coach One', swimmer);

    const content = supabase.rpc.mock.calls[0][1].p_content;
    expect(content).toBe('Strong kick');
    expect(content).not.toContain('Diagnosis:');
    expect(content).not.toContain('Drill:');
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
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(__query.update).not.toHaveBeenCalled();
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
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('videoDrafts.rejectVideoDraft (critical op)', () => {
  it('happy path: flips draft to approved=false', async () => {
    await rejectVideoDraft('sess-VID-001', 'draft-VID-001', 'coach-001');
    expect(supabase.from).toHaveBeenCalledWith('video_session_drafts');
    expect(__query.update).toHaveBeenCalledWith(expect.objectContaining({ approved: false }));
    expect(__query.eq).toHaveBeenCalledWith('id', 'draft-VID-001');
  });

  it('failure-shape: rejecting MUST NOT post a swimmer note', async () => {
    await rejectVideoDraft('sess-VID-001', 'draft-VID-001', 'coach-001');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(__query.insert).not.toHaveBeenCalled();
  });

  it('edge: rejection records reviewer uid', async () => {
    await rejectVideoDraft('sess-VID-002', 'draft-VID-099', 'coach-007');
    const patch = __query.update.mock.calls[0][0];
    expect(patch.reviewed_by).toBe('coach-007');
    expect(patch.reviewed_at).toBeDefined();
  });
});
