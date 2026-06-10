// Phase G: dailyDigest moved whole onto canonical Postgres (OD-4 / D-G3).
// Subjects kept and re-pointed: per-recipient digest creation, the
// explicit-opt-out skip, the video-count body line. NAMED DELETION (its
// subject — the Firestore coaches.notificationPrefs map — was deleted):
//   - "should skip coaches without dailyDigest preference"
// replaced by the RATIFIED D-G3 edge flip pinned below: a staff member with
// NO preferences row is INCLUDED (the canonical default-true world).
interface ThenableBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  or: jest.Mock;
  is: jest.Mock;
  in: jest.Mock;
  insert: jest.Mock;
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: () => { data?: unknown; count?: number; error: null }) {
  const builder: ThenableBuilder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    or: jest.fn(() => builder),
    is: jest.fn(() => builder),
    in: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
  };
  return builder;
}

const state: {
  attendanceRows: unknown[];
  notesCount: number;
  videoReviewCount: number;
  staffRows: unknown[];
  prefRows: unknown[];
} = {
  attendanceRows: [],
  notesCount: 0,
  videoReviewCount: 0,
  staffRows: [],
  prefRows: [],
};

const attendanceBuilder = makeBuilder(() => ({ data: state.attendanceRows, error: null }));
const notesBuilder = makeBuilder(() => ({ count: state.notesCount, error: null }));
const videosBuilder = makeBuilder(() => ({ count: state.videoReviewCount, error: null }));
const profilesBuilder = makeBuilder(() => ({ data: state.staffRows, error: null }));
const prefsBuilder = makeBuilder(() => ({ data: state.prefRows, error: null }));
const inAppBuilder = makeBuilder(() => ({ data: null, error: null }));

const mockFrom = jest.fn((table: string) => {
  if (table === 'attendance') return attendanceBuilder;
  if (table === 'swimmer_notes') return notesBuilder;
  if (table === 'video_sessions') return videosBuilder;
  if (table === 'profiles') return profilesBuilder;
  if (table === 'notification_preferences') return prefsBuilder;
  return inAppBuilder;
});

jest.mock('../config/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { dailyDigest, runDailyDigestOnce } from '../scheduled/dailyDigest';

beforeEach(() => {
  jest.clearAllMocks();
  state.attendanceRows = [
    { swimmer_id: 's1' },
    { swimmer_id: 's2' },
    { swimmer_id: 's1' }, // duplicate: two-a-day — counted once (distinct swimmers)
  ];
  state.notesCount = 3;
  state.videoReviewCount = 0;
  state.staffRows = [{ user_id: 'coach-1' }, { user_id: 'coach-2' }];
  state.prefRows = [];
});

describe('dailyDigest', () => {
  it('should be defined', () => {
    expect(dailyDigest).toBeDefined();
  });

  it('creates one digest per staff recipient with the verbatim body', async () => {
    const written = await runDailyDigestOnce();

    expect(written).toBe(2);
    expect(inAppBuilder.insert).toHaveBeenCalledTimes(1); // ONE batched insert
    const rows = inAppBuilder.insert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      user_id: 'coach-1',
      title: 'Daily Practice Summary',
      body: '2 swimmers attended today. 3 notes recorded.',
      category: 'daily_digest',
      data: { date: expect.any(String) },
      is_read: false,
    });
    expect(rows[1]).toEqual(expect.objectContaining({ user_id: 'coach-2' }));
  });

  it('counts presence under D-C5 + the departed_at IS NULL rule (RC-13)', async () => {
    await runDailyDigestOnce();

    expect(attendanceBuilder.or).toHaveBeenCalledWith('status.is.null,status.neq.absent');
    expect(attendanceBuilder.is).toHaveBeenCalledWith('departed_at', null);
  });

  it('enumerates recipients from the STAFF ROLE SET, never from preference rows (RG-8)', async () => {
    await runDailyDigestOnce();

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(profilesBuilder.in).toHaveBeenCalledWith('role', ['coach_admin', 'super_admin']);
  });

  it('skips staff who explicitly disabled the digest (digest_enabled = false)', async () => {
    state.prefRows = [{ user_id: 'coach-1', digest_enabled: false }];

    const written = await runDailyDigestOnce();

    expect(written).toBe(1);
    const rows = inAppBuilder.insert.mock.calls[0][0] as Record<string, unknown>[];
    expect(rows).toEqual([expect.objectContaining({ user_id: 'coach-2' })]);
  });

  it('includes staff with NO preferences row — the ratified D-G3 canonical-default flip', async () => {
    // coach-1 has an explicit true row; coach-2 has NO row at all — both get
    // the digest (missing-row formerly meant skip; the column default flips it)
    state.prefRows = [{ user_id: 'coach-1', digest_enabled: true }];

    const written = await runDailyDigestOnce();

    expect(written).toBe(2);
  });

  it('includes the video review count in the body with the verbatim pluralization', async () => {
    state.videoReviewCount = 1;
    await runDailyDigestOnce();
    let rows = inAppBuilder.insert.mock.calls[0][0] as { body: string }[];
    expect(rows[0].body).toBe(
      '2 swimmers attended today. 3 notes recorded. 1 video analysis ready for review.',
    );

    jest.clearAllMocks();
    state.videoReviewCount = 2;
    await runDailyDigestOnce();
    rows = inAppBuilder.insert.mock.calls[0][0] as { body: string }[];
    expect(rows[0].body).toBe(
      '2 swimmers attended today. 3 notes recorded. 2 video analyses ready for review.',
    );
  });

  it('writes nothing when every staff member opted out', async () => {
    state.prefRows = [
      { user_id: 'coach-1', digest_enabled: false },
      { user_id: 'coach-2', digest_enabled: false },
    ];

    const written = await runDailyDigestOnce();

    expect(written).toBe(0);
    expect(inAppBuilder.insert).not.toHaveBeenCalled();
  });
});
