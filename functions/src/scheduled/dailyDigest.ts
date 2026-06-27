// Phase G: the daily digest, moved whole onto canonical Postgres (OD-4
// resolved by D-G3). Recipients are enumerated from the STAFF ROLE SET by
// construction — never from preference rows — which is what keeps the DIGEST
// DOCTRINE provable: the body carries only team-wide counts of staff-readable
// tables, and it is addressed only to staff (RG-8). The preference gate is
// notification_preferences.digest_enabled; a MISSING row means included (the
// ratified D-G3 edge flip: signup always wrote default-true, and the column
// default replaces that write at cutover).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { supabase, SUPABASE_SERVICE_ROLE_KEY } from '../config/supabase';

// [D-C5] presence-meaning read: BSPC-marked absences never count as attended.
const NOT_ABSENT = 'status.is.null,status.neq.absent';

export async function runDailyDigestOnce(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  // "still at practice" semantics preserved (RC-13): departed_at IS NULL
  // means the same thing the Firestore !departedAt filter meant.
  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('swimmer_id')
    .eq('practice_date', today)
    .or(NOT_ABSENT)
    .is('departed_at', null);
  const presentCount = new Set(
    ((attendanceRows ?? []) as { swimmer_id: string }[]).map((row) => row.swimmer_id),
  ).size;

  const { count: notesCount } = await supabase
    .from('swimmer_notes')
    .select('*', { count: 'exact', head: true })
    .eq('practice_date', today);

  const { count: videoReviewCount } = await supabase
    .from('video_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'review');

  const { data: staffRows } = await supabase
    .from('profiles')
    .select('user_id')
    .in('role', ['coach_admin', 'super_admin']);
  const staff = (staffRows ?? []) as { user_id: string }[];
  if (staff.length === 0) return 0;

  const { data: prefRows } = await supabase
    .from('notification_preferences')
    .select('user_id, digest_enabled')
    .in(
      'user_id',
      staff.map((s) => s.user_id),
    );
  const optedOut = new Set(
    ((prefRows ?? []) as { user_id: string; digest_enabled: boolean }[])
      .filter((pref) => pref.digest_enabled === false)
      .map((pref) => pref.user_id),
  );
  const recipients = staff.filter((s) => !optedOut.has(s.user_id));
  if (recipients.length === 0) return 0;

  const videos = videoReviewCount ?? 0;
  const body = `${presentCount} swimmers attended today. ${notesCount ?? 0} notes recorded.${
    videos > 0 ? ` ${videos} video ${videos > 1 ? 'analyses' : 'analysis'} ready for review.` : ''
  }`;

  // ONE batched insert. Digest rows carry NULL rule_id — deliberately outside
  // the idempotency index (RG-11: faithful to the Firestore add(); the
  // scheduler fires once daily).
  const rows = recipients.map((s) => ({
    user_id: s.user_id,
    title: 'Daily Practice Summary',
    body,
    category: 'daily_digest',
    data: { date: today },
    is_read: false,
  }));
  const { error } = await supabase.from('in_app_notifications').insert(rows);
  if (error) throw new Error(`dailyDigest insert failed: ${error.message}`);
  return rows.length;
}

export const dailyDigest = onSchedule(
  { schedule: 'every day 20:00', secrets: [SUPABASE_SERVICE_ROLE_KEY] },
  async () => {
    await runDailyDigestOnce();
  },
);
