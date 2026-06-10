jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
}));

// Identity resolves via canonical profiles + guardianships (Phase A Option
// (b)); swimmer reads now come from canonical swimmers + the staff-only
// swimmer_coach_profile / goals embeds (Phase B) — all through the
// service-role client.
const profilesBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
};

const guardianshipsBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn(),
};

const swimmersBuilder = {
  select: jest.fn().mockReturnThis(),
  in: jest.fn(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
};

// Attendance is canonical as of Phase C: select/eq/order chain, limit resolves.
const attendanceBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn(),
};

// Times are canonical as of Phase D: same chain shape against swim_results.
const timesBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn(),
};

const mockSupabaseFrom = jest.fn((table: string) => {
  if (table === 'profiles') return profilesBuilder;
  if (table === 'swimmers') return swimmersBuilder;
  if (table === 'attendance') return attendanceBuilder;
  if (table === 'swim_results') return timesBuilder;
  return guardianshipsBuilder;
});

jest.mock('../config/supabase', () => ({
  // Lazy lookup: jest hoists this factory above the const declarations, so
  // mockSupabaseFrom must be dereferenced at call time, not factory-eval time.
  supabase: { from: (table: string) => mockSupabaseFrom(table) },
}));

import { getParentPortalDashboard, getParentSwimmerPortalData } from '../callable/parentPortal';

function handlerOf(callable: unknown) {
  return (
    (callable as { __wrapped?: unknown; run?: unknown }).__wrapped ??
    (callable as { run?: unknown }).run
  );
}

function makeRequest(
  data: unknown = {},
  auth: { uid: string; token?: { email?: string } } | null = { uid: 'parent-1' },
) {
  return { data, auth };
}

// Canonical swimmers row fixture. The private-ish columns prove the
// sanitizers drop anything beyond the allowed fields.
const makeSwimmerRow = (over: Record<string, unknown> = {}) => ({
  id: 'swimmer-1',
  first_name: 'Jane',
  last_name: 'Smith',
  display_name: 'Jane Smith',
  practice_group: 'Gold',
  gender: 'F',
  is_active: true,
  profile_photo_url: null,
  media_consent_notes: 'private consent detail',
  coach_profile: { strengths: [] },
  goals: [],
  ...over,
});

describe('parent portal callables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    profilesBuilder.select.mockReturnThis();
    profilesBuilder.eq.mockReturnThis();
    guardianshipsBuilder.select.mockReturnThis();
    swimmersBuilder.select.mockReturnThis();
    swimmersBuilder.eq.mockReturnThis();
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: {
        id: 'profile-1',
        email: 'parent@example.com',
        full_name: 'Parent',
        account_status: 'approved',
      },
      error: null,
    });
    guardianshipsBuilder.eq.mockResolvedValue({
      data: [{ swimmer_id: 'swimmer-1' }],
      error: null,
    });
    swimmersBuilder.in.mockResolvedValue({
      data: [makeSwimmerRow()],
      error: null,
    });
    swimmersBuilder.maybeSingle.mockResolvedValue({
      data: makeSwimmerRow(),
      error: null,
    });
    // Canonical swim_results row; the staff-ish extra columns prove the
    // sanitizer drops anything beyond the frozen 8-field shape. There is no
    // stored timeDisplay — the payload derives it from time_hundredths.
    timesBuilder.limit.mockResolvedValue({
      data: [
        {
          id: 'time-1',
          event_name: '50 Free',
          course: 'SCY',
          time_hundredths: 2500,
          is_personal_best: true,
          meet_name: 'Dual Meet',
          date: null,
          created_by: 'coach-uuid-private',
        },
      ],
      error: null,
    });
    // Canonical attendance row; the extra staff-only columns prove the
    // sanitizer drops anything beyond id/practiceDate/status.
    attendanceBuilder.limit.mockResolvedValue({
      data: [
        {
          id: 'att-1',
          practice_date: '2026-04-15',
          status: null, // checked-in
          note: 'private coach note',
          marked_by: 'coach-uuid-private',
        },
      ],
      error: null,
    });
  });

  it('rejects unauthenticated parent portal dashboard requests', async () => {
    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    await expect(handler(makeRequest({}, null))).rejects.toThrow(/Must be authenticated/i);
  });

  it('returns only sanitized linked swimmer summaries on the dashboard', async () => {
    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    const result = await handler(makeRequest());

    expect(result).toEqual({
      profile: {
        uid: 'parent-1',
        email: 'parent@example.com',
        displayName: 'Parent',
        linkedSwimmerIds: ['swimmer-1'],
      },
      swimmers: [
        {
          id: 'swimmer-1',
          firstName: 'Jane',
          lastName: 'Smith',
          displayName: 'Jane Smith',
          group: 'Gold',
          gender: 'F',
          active: true,
          profilePhotoUrl: null,
        },
      ],
    });
  });

  it('rejects detail reads for swimmers not linked to the parent', async () => {
    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    await expect(handler(makeRequest({ swimmerId: 'swimmer-2' }))).rejects.toThrow(
      /permission-denied|not linked/i,
    );
  });

  it('returns sanitized detail data without coach/private fields', async () => {
    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    const result = await handler(makeRequest({ swimmerId: 'swimmer-1' }));

    expect(result).toEqual({
      swimmer: {
        id: 'swimmer-1',
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane Smith',
        group: 'Gold',
        gender: 'F',
        active: true,
        profilePhotoUrl: null,
        strengths: [],
        goals: [],
      },
      times: [
        {
          id: 'time-1',
          event: '50 Free',
          course: 'SCY',
          time: 2500,
          timeDisplay: '25.00',
          isPR: true,
          meetName: 'Dual Meet',
          meetDate: null,
        },
      ],
      attendance: [
        {
          id: 'att-1',
          practiceDate: '2026-04-15',
          status: 'present', // NULL = checked-in collapses to 'present' [D-C4]
        },
      ],
      schedule: [],
    });
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('reads attendance from canonical attendance scoped to the swimmer, newest first, capped at 30', async () => {
    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    await handler(makeRequest({ swimmerId: 'swimmer-1' }));

    expect(mockSupabaseFrom).toHaveBeenCalledWith('attendance');
    expect(attendanceBuilder.select).toHaveBeenCalledWith('id, practice_date, status');
    expect(attendanceBuilder.eq).toHaveBeenCalledWith('swimmer_id', 'swimmer-1');
    expect(attendanceBuilder.order).toHaveBeenCalledWith('practice_date', { ascending: false });
    expect(attendanceBuilder.limit).toHaveBeenCalledWith(30);
  });

  it('reads times from canonical swim_results scoped to the swimmer, newest entry first, capped at 50', async () => {
    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    await handler(makeRequest({ swimmerId: 'swimmer-1' }));

    expect(mockSupabaseFrom).toHaveBeenCalledWith('swim_results');
    expect(timesBuilder.select).toHaveBeenCalledWith(
      'id, event_name, course, time_hundredths, is_personal_best, meet_name, date',
    );
    expect(timesBuilder.eq).toHaveBeenCalledWith('swimmer_id', 'swimmer-1');
    expect(timesBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(timesBuilder.limit).toHaveBeenCalledWith(50);
  });

  it('derives timeDisplay from stored hundredths and keeps the frozen times payload shape', async () => {
    timesBuilder.limit.mockResolvedValue({
      data: [
        {
          id: 'time-2',
          event_name: '100 Free',
          course: 'LCM',
          time_hundredths: 6523,
          is_personal_best: false,
          meet_name: null,
          date: '2026-03-15',
          created_by: 'coach-uuid-private',
        },
      ],
      error: null,
    });

    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    const result = (await handler(makeRequest({ swimmerId: 'swimmer-1' }))) as {
      times: Record<string, unknown>[];
    };

    expect(result.times[0]).toEqual({
      id: 'time-2',
      event: '100 Free',
      course: 'LCM',
      time: 6523,
      timeDisplay: '1:05.23', // derived — canonical stores no display strings
      isPR: false,
      meetName: null,
      meetDate: '2026-03-15',
    });
    expect(Object.keys(result.times[0]).sort()).toEqual([
      'course',
      'event',
      'id',
      'isPR',
      'meetDate',
      'meetName',
      'time',
      'timeDisplay',
    ]);
    expect(JSON.stringify(result.times)).not.toContain('coach-uuid-private');
  });

  it('collapses every raw status to present/absent for guardians (D-C4: one wall, one rule)', async () => {
    attendanceBuilder.limit.mockResolvedValue({
      data: [
        { id: 'a-1', practice_date: '2026-04-15', status: 'sick' },
        { id: 'a-2', practice_date: '2026-04-14', status: 'left_early' },
        { id: 'a-3', practice_date: '2026-04-13', status: null },
        { id: 'a-4', practice_date: '2026-04-12', status: 'present' },
        { id: 'a-5', practice_date: '2026-04-11', status: 'absent' },
      ],
      error: null,
    });

    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    const result = (await handler(makeRequest({ swimmerId: 'swimmer-1' }))) as {
      attendance: { id: string; status: string }[];
    };

    expect(result.attendance.map((a) => a.status)).toEqual([
      'absent', // sick
      'present', // left_early
      'present', // checked-in (NULL)
      'present', // present
      'absent', // absent
    ]);
  });

  it('never surfaces coach notes or marker identity in the attendance payload', async () => {
    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    const result = (await handler(makeRequest({ swimmerId: 'swimmer-1' }))) as {
      attendance: Record<string, unknown>[];
    };

    expect(Object.keys(result.attendance[0]).sort()).toEqual(['id', 'practiceDate', 'status']);
    expect(JSON.stringify(result)).not.toContain('coach-uuid-private');
  });

  it('resolves the caller via profiles.user_id and authorizes via guardianships', async () => {
    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    await handler(makeRequest());

    expect(mockSupabaseFrom).toHaveBeenCalledWith('profiles');
    expect(profilesBuilder.eq).toHaveBeenCalledWith('user_id', 'parent-1');
    expect(mockSupabaseFrom).toHaveBeenCalledWith('guardianships');
    expect(guardianshipsBuilder.eq).toHaveBeenCalledWith('guardian_profile_id', 'profile-1');
  });

  it('returns the placeholder profile and no swimmers when no profiles row exists', async () => {
    profilesBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    const result = await handler(makeRequest());

    expect(result).toEqual({
      profile: { uid: 'parent-1', email: '', displayName: 'Parent', linkedSwimmerIds: [] },
      swimmers: [],
    });
    expect(mockSupabaseFrom).not.toHaveBeenCalledWith('guardianships');
  });

  it('propagates identity resolution failures', async () => {
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('identity store down'),
    });

    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    await expect(handler(makeRequest())).rejects.toThrow('identity store down');
  });

  it('D-I3: a PENDING parent resolves their profile but ZERO linked swimmers — the gate states the is_my_swimmer wall', async () => {
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: {
        id: 'profile-1',
        email: 'pending@example.com',
        full_name: 'Pending Parent',
        account_status: 'pending',
      },
      error: null,
    });

    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    const result = await handler(makeRequest());

    expect(result).toEqual({
      profile: {
        uid: 'parent-1',
        email: 'pending@example.com',
        displayName: 'Pending Parent',
        linkedSwimmerIds: [],
      },
      swimmers: [],
    });
    expect(mockSupabaseFrom).not.toHaveBeenCalledWith('guardianships');
  });

  it('D-I3: a PENDING-but-linked parent is permission-denied on swimmer detail — dark until approval (D-I1)', async () => {
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: {
        id: 'profile-1',
        email: 'pending@example.com',
        full_name: 'Pending Parent',
        account_status: 'pending',
      },
      error: null,
    });

    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    await expect(handler(makeRequest({ swimmerId: 'swimmer-1' }))).rejects.toThrow(
      /permission-denied|not linked/i,
    );
  });

  it('reads roster summaries from canonical swimmers scoped to the linked ids', async () => {
    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    await handler(makeRequest());

    expect(mockSupabaseFrom).toHaveBeenCalledWith('swimmers');
    expect(swimmersBuilder.in).toHaveBeenCalledWith('id', ['swimmer-1']);
  });

  it('skips dangling linked ids with no swimmers row (old not-found path)', async () => {
    guardianshipsBuilder.eq.mockResolvedValue({
      data: [{ swimmer_id: 'swimmer-1' }, { swimmer_id: 'swimmer-gone' }],
      error: null,
    });
    // only swimmer-1 has a row
    swimmersBuilder.in.mockResolvedValue({ data: [makeSwimmerRow()], error: null });

    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    const result = (await handler(makeRequest())) as { swimmers: { id: string }[] };

    expect(result.swimmers).toHaveLength(1);
    expect(result.swimmers[0].id).toBe('swimmer-1');
  });

  it('returns not-found when the linked swimmer row is missing on the detail read', async () => {
    swimmersBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    await expect(handler(makeRequest({ swimmerId: 'swimmer-1' }))).rejects.toThrow(
      /not.found|Swimmer not found/i,
    );
  });

  it('derives portal strengths and goals from the companion table and goals rows', async () => {
    swimmersBuilder.maybeSingle.mockResolvedValue({
      data: makeSwimmerRow({
        coach_profile: { strengths: ['underwaters'] },
        goals: [{ event_name: '100 Free' }, { event_name: '200 IM' }],
      }),
      error: null,
    });

    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    const result = (await handler(makeRequest({ swimmerId: 'swimmer-1' }))) as {
      swimmer: { strengths: string[]; goals: string[] };
    };

    expect(result.swimmer.strengths).toEqual(['underwaters']);
    expect(result.swimmer.goals).toEqual(['100 Free', '200 IM']);
  });
});
