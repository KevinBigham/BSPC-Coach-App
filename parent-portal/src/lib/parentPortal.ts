import { supabase } from './supabase';
import { getParentProfile } from './profile';

export interface ParentProfile {
  uid: string;
  email: string;
  displayName: string;
  linkedSwimmerIds: string[];
}

export interface ParentSwimmerSummary {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  group: string;
  gender: string;
  active: boolean;
  profilePhotoUrl: string | null;
}

export interface ParentSwimmerDetail extends ParentSwimmerSummary {
  strengths: string[];
  goals: string[];
}

export interface ParentSwimTime {
  id: string;
  event: string;
  course: string;
  time: number;
  timeDisplay: string;
  isPR: boolean;
  meetName: string | null;
  meetDate: string | null;
}

export interface ParentAttendanceSummary {
  id: string;
  practiceDate: string;
  status: string | null;
}

export interface ParentScheduleEvent {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
}

export interface ParentPortalDashboard {
  profile: ParentProfile;
  swimmers: ParentSwimmerSummary[];
}

export interface ParentSwimmerPortalData {
  swimmer: ParentSwimmerDetail;
  times: ParentSwimTime[];
  attendance: ParentAttendanceSummary[];
  schedule: ParentScheduleEvent[];
}

export interface RedeemInviteResponse {
  success: boolean;
  swimmerId: string;
  swimmerName: string;
}

// ---------------------------------------------------------------------------
// Direct-read transport (D-CUT6 end-state; CALL-4 BUILD-AT-SWAP, 05 §6.6).
// The Firebase callables died with the portal's Firebase session — a Supabase
// session carries no request.auth for onCall. Each loader below reads the
// SAME sanitized fields the callable served, now under the parent RLS walls
// (swimmers two-arm + swimmer_strengths_parent_view from BSPC 00013; the
// goals/swim_results two-arms; attendance_parent_view). The DTO interfaces
// above are FROZEN — nothing beyond these fields ever leaves.
// ---------------------------------------------------------------------------

const SWIMMER_SUMMARY_SELECT =
  'id, first_name, last_name, display_name, practice_group, gender, is_active, profile_photo_url';
const TIME_SELECT = 'id, event_name, course, time_hundredths, is_personal_best, meet_name, date';

interface SwimmerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  practice_group: string | null;
  gender: string | null;
  is_active: boolean | null;
  profile_photo_url: string | null;
}

interface TimeRow {
  id: string;
  event_name: string | null;
  course: string | null;
  time_hundredths: number | null;
  is_personal_best: boolean | null;
  meet_name: string | null;
  date: string | null;
}

interface AttendanceRow {
  id: string;
  practice_date: string;
  status: string | null;
}

function toSwimmerSummary(row: SwimmerRow): ParentSwimmerSummary {
  const firstName = row.first_name ?? '';
  const lastName = row.last_name ?? '';
  return {
    id: row.id,
    firstName,
    lastName,
    displayName: row.display_name ?? `${firstName} ${lastName}`.trim(),
    group: row.practice_group ?? '',
    gender: row.gender ?? '',
    active: row.is_active ?? false,
    profilePhotoUrl: row.profile_photo_url || null,
  };
}

// RD-12: timeDisplay derives client-side — the same pure formatter the
// callable carried (canonical stores no display strings).
function formatTimeDisplay(hundredths: number): string {
  const min = Math.floor(hundredths / 6000);
  const sec = Math.floor((hundredths % 6000) / 100);
  const hund = hundredths % 100;

  const hundStr = String(hund).padStart(2, '0');
  if (min > 0) {
    return `${min}:${String(sec).padStart(2, '0')}.${hundStr}`;
  }
  return `${sec}.${hundStr}`;
}

async function requireSessionUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id;
  if (!uid) throw new Error('Must be authenticated');
  return uid;
}

export async function loadParentPortalDashboard(): Promise<ParentPortalDashboard> {
  const uid = await requireSessionUserId();
  const profile = await getParentProfile(uid);
  if (!profile) throw new Error('No parent profile for this account');

  if (profile.linkedSwimmerIds.length === 0) {
    return { profile, swimmers: [] };
  }

  const { data, error } = await supabase
    .from('swimmers')
    .select(SWIMMER_SUMMARY_SELECT)
    .in('id', profile.linkedSwimmerIds);
  if (error) throw error;

  const rowsById = new Map(((data ?? []) as unknown as SwimmerRow[]).map((row) => [row.id, row]));
  // Preserve the linked order and skip dangling links — the callable's exact
  // behavior, which itself matched the old per-id Firestore reads.
  const swimmers = profile.linkedSwimmerIds
    .map((id) => rowsById.get(id))
    .filter((row): row is SwimmerRow => Boolean(row))
    .map(toSwimmerSummary);

  return { profile, swimmers };
}

export async function loadParentSwimmerPortalData(
  swimmerId: string,
): Promise<ParentSwimmerPortalData> {
  const uid = await requireSessionUserId();
  const profile = await getParentProfile(uid);
  if (!profile) throw new Error('No parent profile for this account');
  if (!profile.linkedSwimmerIds.includes(swimmerId)) {
    throw new Error('This swimmer is not linked to your account');
  }

  const { data: swimmerRow, error: swimmerError } = await supabase
    .from('swimmers')
    .select(SWIMMER_SUMMARY_SELECT)
    .eq('id', swimmerId)
    .maybeSingle();
  if (swimmerError) throw swimmerError;
  if (!swimmerRow) throw new Error('Swimmer not found');

  // GAP-2 surface: parents read EXACTLY (swimmer_id, strengths) through the
  // 00013 view; swimmer_coach_profile itself stays staff-only.
  const { data: strengthsRow, error: strengthsError } = await supabase
    .from('swimmer_strengths_parent_view')
    .select('strengths')
    .eq('swimmer_id', swimmerId)
    .maybeSingle();
  if (strengthsError) throw strengthsError;

  const { data: goalRows, error: goalsError } = await supabase
    .from('goals')
    .select('event_name')
    .eq('swimmer_id', swimmerId);
  if (goalsError) throw goalsError;

  // Newest entries first — the same 50-row window as the callable.
  const { data: timeRows, error: timesError } = await supabase
    .from('swim_results')
    .select(TIME_SELECT)
    .eq('swimmer_id', swimmerId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (timesError) throw timesError;

  // attendance_parent_view already serves the D-C4 present/absent collapse —
  // raw statuses, notes and marker identity never leave the staff side.
  const { data: attendanceRows, error: attendanceError } = await supabase
    .from('attendance_parent_view')
    .select('id, practice_date, status')
    .eq('swimmer_id', swimmerId)
    .order('practice_date', { ascending: false })
    .limit(30);
  if (attendanceError) throw attendanceError;

  return {
    swimmer: {
      ...toSwimmerSummary(swimmerRow as unknown as SwimmerRow),
      strengths: ((strengthsRow as { strengths: string[] | null } | null)?.strengths ?? []).filter(
        (item): item is string => typeof item === 'string',
      ),
      goals: ((goalRows ?? []) as { event_name: string | null }[])
        .map((goal) => goal.event_name ?? '')
        .filter(Boolean),
    },
    times: ((timeRows ?? []) as TimeRow[]).map((row) => {
      const time = row.time_hundredths ?? 0;
      return {
        id: row.id,
        event: row.event_name ?? '',
        course: row.course ?? '',
        time,
        timeDisplay: formatTimeDisplay(time),
        isPR: row.is_personal_best ?? false,
        meetName: row.meet_name || null,
        meetDate: row.date ?? null,
      };
    }),
    attendance: ((attendanceRows ?? []) as AttendanceRow[]).map((row) => ({
      id: row.id,
      practiceDate: row.practice_date,
      status: row.status,
    })),
    // Parity-is-empty: the callable has served [] since Phase H (D-H5(b) —
    // the calendar went staff-only; parent arms ship only with a parent
    // calendar feature).
    schedule: [] as ParentScheduleEvent[],
  };
}

export async function redeemParentInvite(code: string): Promise<RedeemInviteResponse> {
  // The RPC's designed authenticated path (D-I2, BSPC 00010): auth.uid()
  // derives the redeemer server-side and the profile param is IGNORED for end
  // users — spoof-proof. The INV01/INV02/INV03 signals map onto the SAME
  // frozen message strings the Phase-I callable shell carried.
  const { data, error } = await supabase.rpc('redeem_parent_invite', { p_code: code });
  if (error) {
    const sqlstate = (error as { code?: string }).code;
    if (sqlstate === 'INV01') throw new Error('Invalid or already redeemed invite code');
    if (sqlstate === 'INV02') throw new Error('This invite code has expired');
    if (sqlstate === 'INV03') throw new Error('This swimmer is already linked to your account');
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    swimmer_id: string;
    swimmer_name: string;
  };

  return {
    success: true,
    swimmerId: row.swimmer_id,
    swimmerName: row.swimmer_name,
  };
}
