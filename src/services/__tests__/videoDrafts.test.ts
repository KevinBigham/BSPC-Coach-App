// Phase F: approve goes through the atomic approve_session_draft RPC (D-F6)
// — the Firestore draft-update half is gone with the subcollection. The
// content-composition and consent pins are unchanged in substance; the
// assertion target moved (updateDoc/insert -> rpc payload).
jest.mock('../../config/supabase', () => {
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

import { approveVideoDraft, rejectVideoDraft, type VideoDraft } from '../videoDrafts';
import type { Swimmer } from '../../types/firestore.types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../config/supabase');
const { supabase, __query } = supabaseMock;

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
  it('calls the atomic RPC as kind=video with the draft id and reviewer (D-F6)', async () => {
    await approveVideoDraft('session-1', makeDraft(), 'coach-1', 'Coach Kevin', consentedSwimmer);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'approve_session_draft',
      expect.objectContaining({
        p_kind: 'video',
        p_draft_id: 'draft-1',
        p_coach_id: 'coach-1',
        p_tags: ['technique'],
      }),
    );
  });

  it('note content includes observation, diagnosis, and drill', async () => {
    await approveVideoDraft('session-1', makeDraft(), 'coach-1', 'Coach Kevin', consentedSwimmer);
    const content = supabase.rpc.mock.calls[0][1].p_content;
    expect(content).toContain('Elbow drops on recovery');
    expect(content).toContain('Diagnosis: Shoulder fatigue');
    expect(content).toContain('Drill: Catch-up drill');
  });

  it('omits empty diagnosis/drill lines', async () => {
    const draft = makeDraft({ diagnosis: '', drillRecommendation: '' });
    await approveVideoDraft('session-1', draft, 'coach-1', 'Coach Kevin', consentedSwimmer);
    const content = supabase.rpc.mock.calls[0][1].p_content;
    expect(content).not.toContain('Diagnosis:');
    expect(content).not.toContain('Drill:');
  });

  it('rejects when roster context is present but media consent is missing', async () => {
    await expect(
      approveVideoDraft('session-1', makeDraft(), 'coach-1', 'Coach Kevin', blockedSwimmer),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('surfaces an RPC error', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('draft not found') });
    await expect(
      approveVideoDraft('session-1', makeDraft(), 'coach-1', 'Coach Kevin', consentedSwimmer),
    ).rejects.toThrow('draft not found');
  });
});

describe('rejectVideoDraft', () => {
  it('marks the draft as rejected with reviewer provenance — no RPC, no note', async () => {
    await rejectVideoDraft('session-1', 'draft-1', 'coach-1');
    expect(supabase.from).toHaveBeenCalledWith('video_session_drafts');
    expect(__query.update).toHaveBeenCalledWith(
      expect.objectContaining({ approved: false, reviewed_by: 'coach-1' }),
    );
    expect(__query.eq).toHaveBeenCalledWith('id', 'draft-1');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
