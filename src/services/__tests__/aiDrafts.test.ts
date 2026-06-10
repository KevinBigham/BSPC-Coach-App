// Phase F: the draft-half joined the note-half on canonical Postgres. The E
// seam tests are gone WITH their subject (the two-store split no longer
// exists — approve_session_draft() is one transaction, proven in pgTAP 010);
// what's pinned here is the RPC payload, the consent gates (BUG #4,
// unchanged), the joined pending read, and the per-draft approve loop.
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
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
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.onHandler = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn(() => query),
    rpc: jest.fn(() => Promise.resolve({ data: 'note-uuid-1', error: null })),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  return { supabase, __state: state, __query: query, __channel: channel };
});

import {
  subscribePendingDrafts,
  approveDraft,
  rejectDraft,
  approveAllDrafts,
  checkAndCompleteSession,
} from '../aiDrafts';
import type { AIDraft, Swimmer } from '../../types/firestore.types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = supabaseMock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
});

const mockDraft: AIDraft = {
  swimmerId: 'sw-1',
  swimmerName: 'Jane Doe',
  observation: 'Good pull pattern',
  tags: ['technique'],
  confidence: 0.9,
} as AIDraft;

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

const assertApproveDraftRequiresRosterContext = () => {
  // @ts-expect-error approveDraft requires a swimmer roster context argument.
  void approveDraft('session-1', 'draft-1', mockDraft, 'coach-1', undefined, undefined);
};
void assertApproveDraftRequiresRosterContext;

const assertApproveAllDraftsRequiresRosterContext = () => {
  // @ts-expect-error approveAllDrafts requires a swimmersById roster context argument.
  void approveAllDrafts([{ ...mockDraft, id: 'd1', sessionId: 's1' }], 'coach-1', 'Coach Kevin');
};
void assertApproveAllDraftsRequiresRosterContext;

const today = () => new Date().toISOString().split('T')[0];

describe('subscribePendingDrafts', () => {
  it('replaces the Firestore N+1 with ONE joined read: pending drafts of in-review sessions', () => {
    subscribePendingDrafts(jest.fn());
    expect(supabase.from).toHaveBeenCalledWith('audio_session_drafts');
    expect(__query.is).toHaveBeenCalledWith('approved', null);
    expect(__query.eq).toHaveBeenCalledWith('session.status', 'review');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('listens to BOTH drafts and sessions — either changes the pending set', () => {
    subscribePendingDrafts(jest.fn());
    const tables = __channel.on.mock.calls.map(
      (c: [unknown, { table: string }, unknown]) => c[1].table,
    );
    expect(tables).toEqual(['audio_session_drafts', 'audio_sessions']);
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('maps rows with session context and the derived swimmer name', async () => {
    __state.selectRows = [
      {
        id: 'd-1',
        session_id: 'sess-1',
        swimmer_id: 'sw-1',
        observation: 'Good pull pattern',
        tags: ['technique'],
        confidence: 0.9,
        approved: null,
        created_at: '2026-06-09T18:00:00.000Z',
        swimmer: { display_name: 'Jane Doe' },
        session: { practice_group: 'Gold', status: 'review' },
      },
    ];
    const cb = jest.fn();
    subscribePendingDrafts(cb);
    await flush();
    expect(cb.mock.calls[0][0][0]).toMatchObject({
      id: 'd-1',
      sessionId: 'sess-1',
      sessionGroup: 'Gold',
      swimmerId: 'sw-1',
      swimmerName: 'Jane Doe',
      observation: 'Good pull pattern',
      approved: undefined,
    });
  });
});

describe('approveDraft', () => {
  it('calls the atomic approve_session_draft RPC with the draft content (D-F6 — the E seam is healed)', async () => {
    await approveDraft(
      'session-1',
      'draft-1',
      mockDraft,
      'coach-1',
      undefined,
      undefined,
      consentedSwimmer,
    );
    expect(supabase.rpc).toHaveBeenCalledWith('approve_session_draft', {
      p_kind: 'audio',
      p_draft_id: 'draft-1',
      p_coach_id: 'coach-1',
      p_content: 'Good pull pattern',
      p_tags: ['technique'],
      p_practice_date: today(),
    });
  });

  it('uses edited content and tags when provided', async () => {
    await approveDraft(
      'session-1',
      'draft-1',
      mockDraft,
      'coach-1',
      'Edited observation',
      ['freestyle'],
      consentedSwimmer,
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'approve_session_draft',
      expect.objectContaining({ p_content: 'Edited observation', p_tags: ['freestyle'] }),
    );
  });

  it('rejects when roster context is present but media consent is missing', async () => {
    await expect(
      approveDraft(
        'session-1',
        'draft-1',
        mockDraft,
        'coach-1',
        undefined,
        undefined,
        blockedSwimmer,
      ),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('surfaces an RPC error', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('draft not found') });
    await expect(
      approveDraft(
        'session-1',
        'draft-1',
        mockDraft,
        'coach-1',
        undefined,
        undefined,
        consentedSwimmer,
      ),
    ).rejects.toThrow('draft not found');
  });
});

describe('rejectDraft', () => {
  it('marks the draft as rejected with reviewer provenance — and never posts a note', async () => {
    await rejectDraft('session-1', 'draft-1', 'coach-1');
    expect(supabase.from).toHaveBeenCalledWith('audio_session_drafts');
    expect(__query.update).toHaveBeenCalledWith(
      expect.objectContaining({ approved: false, reviewed_by: 'coach-1' }),
    );
    expect(__query.update.mock.calls[0][0].reviewed_at).toEqual(expect.any(String));
    expect(__query.eq).toHaveBeenCalledWith('id', 'draft-1');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('approveAllDrafts', () => {
  const makeDrafts = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...mockDraft,
      id: `d${i}`,
      sessionId: `s${i % 3}`,
      swimmerId: 'sw-1',
    }));

  it('approves each draft through the atomic RPC and returns the count', async () => {
    const drafts = makeDrafts(4);
    const swimmersById = new Map([['sw-1', consentedSwimmer]]);
    const approved = await approveAllDrafts(drafts, 'coach-1', 'Coach Kevin', swimmersById);
    expect(approved).toBe(4);
    expect(supabase.rpc).toHaveBeenCalledTimes(4);
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'approve_session_draft', {
      p_kind: 'audio',
      p_draft_id: 'd0',
      p_coach_id: 'coach-1',
      p_content: 'Good pull pattern',
      p_tags: ['technique'],
      p_practice_date: today(),
    });
  });

  it('rejects before ANY approve when the roster map lacks a draft swimmer', async () => {
    const drafts = makeDrafts(3);
    await expect(approveAllDrafts(drafts, 'coach-1', 'Coach Kevin', new Map())).rejects.toThrow(
      /roster context/i,
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects before ANY approve when one swimmer lacks consent (BUG #4 pre-flight)', async () => {
    const drafts = makeDrafts(2);
    const swimmersById = new Map([['sw-1', blockedSwimmer]]);
    await expect(approveAllDrafts(drafts, 'coach-1', 'Coach Kevin', swimmersById)).rejects.toThrow(
      /media consent|cannot tag/i,
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('stops at the first RPC failure — earlier drafts stay approved, the failed one is untouched (per-draft atomicity)', async () => {
    const drafts = makeDrafts(3);
    const swimmersById = new Map([['sw-1', consentedSwimmer]]);
    supabase.rpc
      .mockResolvedValueOnce({ data: 'n1', error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('23514') });
    await expect(approveAllDrafts(drafts, 'coach-1', 'Coach Kevin', swimmersById)).rejects.toThrow(
      '23514',
    );
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});

describe('checkAndCompleteSession', () => {
  it('marks the session posted when all drafts are reviewed (the one completion owner)', async () => {
    __state.selectRows = [{ approved: true }, { approved: false }];
    await checkAndCompleteSession('sess-1');
    expect(__query.eq).toHaveBeenCalledWith('session_id', 'sess-1');
    expect(__query.update).toHaveBeenCalledWith({ status: 'posted' });
    expect(__query.eq).toHaveBeenCalledWith('id', 'sess-1');
  });

  it('does not mark the session when some drafts are unreviewed', async () => {
    __state.selectRows = [{ approved: true }, { approved: null }];
    await checkAndCompleteSession('sess-1');
    expect(__query.update).not.toHaveBeenCalled();
  });

  it('does not mark the session when there are no drafts', async () => {
    __state.selectRows = [];
    await checkAndCompleteSession('sess-1');
    expect(__query.update).not.toHaveBeenCalled();
  });
});
