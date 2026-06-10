// Phase F: re-pointed at the atomic approve_session_draft RPC (D-F6). The
// Phase E two-store mechanics tests (one-batch-commit-then-notes-insert, the
// 400-item chunking) are DELETED WITH THEIR SUBJECT — that seam no longer
// exists; pgTAP 010 proves the replacement transaction (note + review-stamp
// + posted_note_id, all-or-nothing, idempotent). The BUG #4 consent pins are
// UNCHANGED in substance: every rejection proves NO write happened.
jest.mock('../../src/config/supabase', () => {
  const state: { selectRows: unknown[] } = { selectRows: [] };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    order: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, error: null }).then(resolve, reject),
  };
  const supabase = {
    from: jest.fn(() => query),
    rpc: jest.fn(() => Promise.resolve({ data: 'note-uuid-1', error: null })),
  };
  return { supabase, __state: state, __query: query };
});

import {
  approveDraft,
  rejectDraft,
  approveAllDrafts,
  checkAndCompleteSession,
} from '../../src/services/aiDrafts';
import type { AIDraft } from '../../src/types/firestore.types';
import { buildSwimmer, buildMediaConsent } from '../fixtures/coach';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../src/config/supabase');
const { supabase, __state, __query } = supabaseMock;

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
});

const draft: AIDraft = {
  swimmerId: 'swimmer-001',
  swimmerName: 'Swimmer One',
  observation: 'Strong catch on freestyle',
  tags: ['technique', 'freestyle'],
  confidence: 0.92,
} as AIDraft;

describe('aiDrafts.approveDraft (critical op)', () => {
  it('happy path: one atomic RPC call carries the draft content + reviewer (note insert AND review-stamp together)', async () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });

    await approveDraft('sess-1', 'draft-1', draft, 'coach-001', undefined, undefined, consented);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'approve_session_draft',
      expect.objectContaining({
        p_kind: 'audio',
        p_draft_id: 'draft-1',
        p_coach_id: 'coach-001',
        p_content: 'Strong catch on freestyle',
        p_tags: ['technique', 'freestyle'],
      }),
    );
  });

  it('edge: edited content and tags override the draft values', async () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });

    await approveDraft(
      'sess-1',
      'draft-1',
      draft,
      'coach-001',
      'Edited text',
      ['endurance'],
      consented,
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      'approve_session_draft',
      expect.objectContaining({ p_content: 'Edited text', p_tags: ['endurance'] }),
    );
  });

  it('failure mode (BUG #4): rejects when supplied swimmer has mediaConsent.granted=false', async () => {
    const blocked = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: false }) },
    });

    await expect(
      approveDraft('sess-1', 'draft-1', draft, 'coach-001', undefined, undefined, blocked),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('failure mode (BUG #4): rejects when supplied swimmer has doNotPhotograph=true even with granted consent', async () => {
    const blocked = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: {
        doNotPhotograph: true,
        mediaConsent: buildMediaConsent({ granted: true }),
      },
    });

    await expect(
      approveDraft('sess-1', 'draft-1', draft, 'coach-001', undefined, undefined, blocked),
    ).rejects.toThrow(/do_not_photograph|cannot tag/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('happy path with roster: passes through when supplied swimmer is consented', async () => {
    const consented = buildSwimmer({
      index: 3,
      group: 'Gold',
      overrides: { active: true, mediaConsent: buildMediaConsent({ granted: true }) },
    });

    await expect(
      approveDraft('sess-1', 'draft-1', draft, 'coach-001', undefined, undefined, consented),
    ).resolves.toBeUndefined();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('aiDrafts.rejectDraft (critical op)', () => {
  it('happy path: flips draft to approved=false', async () => {
    await rejectDraft('sess-1', 'draft-1', 'coach-001');
    expect(__query.update).toHaveBeenCalledWith(expect.objectContaining({ approved: false }));
    expect(__query.eq).toHaveBeenCalledWith('id', 'draft-1');
  });

  it('failure-shape: rejecting MUST NOT post a swimmer note', async () => {
    await rejectDraft('sess-1', 'draft-1', 'coach-001');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(__query.insert).not.toHaveBeenCalled();
  });

  it('edge: rejection records the reviewer uid', async () => {
    await rejectDraft('sess-1', 'draft-1', 'coach-001');
    expect(__query.update).toHaveBeenCalledWith(
      expect.objectContaining({ reviewed_by: 'coach-001' }),
    );
  });
});

describe('aiDrafts.approveAllDrafts (critical op)', () => {
  const makeDrafts = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...draft,
      id: `draft-${i}`,
      sessionId: `sess-${i % 2}`,
      swimmerId: 'swimmer-001',
    }));

  it('happy path: 4 drafts -> 4 atomic RPC approvals, count returned', async () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const swimmersById = new Map([['swimmer-001', consented]]);

    const approved = await approveAllDrafts(makeDrafts(4), 'coach-001', 'Coach One', swimmersById);

    expect(approved).toBe(4);
    expect(supabase.rpc).toHaveBeenCalledTimes(4);
    const draftIds = supabase.rpc.mock.calls.map(
      (c: [string, { p_draft_id: string }]) => c[1].p_draft_id,
    );
    expect(draftIds).toEqual(['draft-0', 'draft-1', 'draft-2', 'draft-3']);
  });

  it('edge: a mid-loop RPC failure stops the run — earlier drafts approved, no partial draft anywhere (re-run is idempotent)', async () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const swimmersById = new Map([['swimmer-001', consented]]);
    supabase.rpc
      .mockResolvedValueOnce({ data: 'n0', error: null })
      .mockResolvedValueOnce({ data: 'n1', error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('draft not found') });

    await expect(
      approveAllDrafts(makeDrafts(4), 'coach-001', 'Coach One', swimmersById),
    ).rejects.toThrow('draft not found');
    expect(supabase.rpc).toHaveBeenCalledTimes(3); // stopped at the failure; draft-3 untouched
  });

  it('failure mode (BUG #4): rejects without ANY approve when one tagged swimmer lacks consent', async () => {
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
    const drafts = [
      { ...draft, id: 'draft-0', sessionId: 'sess-0', swimmerId: consented.id },
      { ...draft, id: 'draft-1', sessionId: 'sess-0', swimmerId: blocked.id },
    ];
    const swimmersById = new Map([
      [consented.id, consented],
      [blocked.id, blocked],
    ]);

    await expect(approveAllDrafts(drafts, 'coach-001', 'Coach One', swimmersById)).rejects.toThrow(
      /media consent|cannot tag/i,
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('aiDrafts.checkAndCompleteSession (critical op)', () => {
  it('happy path: marks session posted when every draft is reviewed', async () => {
    __state.selectRows = [{ approved: true }, { approved: false }, { approved: true }];
    await checkAndCompleteSession('sess-1');
    expect(__query.update).toHaveBeenCalledWith({ status: 'posted' });
  });

  it('edge: does NOT transition when any draft is still pending (approved null)', async () => {
    __state.selectRows = [{ approved: true }, { approved: null }];
    await checkAndCompleteSession('sess-1');
    expect(__query.update).not.toHaveBeenCalled();
  });

  it('failure-shape: does NOT transition when there are zero drafts', async () => {
    __state.selectRows = [];
    await checkAndCompleteSession('sess-1');
    expect(__query.update).not.toHaveBeenCalled();
  });
});
