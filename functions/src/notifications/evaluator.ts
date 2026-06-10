// Phase G (D-G1): the rule-evaluation core, ported from the retired Firestore
// trigger (evaluateNotificationRules). The attendance data layer kicks the
// HTTPS entry with ROW IDS ONLY; everything else — swimmer, group, marker,
// practice date — is re-derived here from canonical Postgres, so nothing in
// the client payload is trusted beyond the id (the processSession precedent).
// Writes go through upsert_rule_notification(), whose ON CONFLICT carries the
// prior deterministic-id merge semantics: a re-fire (kick + sweep overlap,
// checkout re-evaluation) refreshes one row and can never duplicate it.
import { supabase } from '../config/supabase';
import {
  evaluateAttendanceStreakCount,
  evaluateMissedPracticeGap,
  ruleAppliesToSwimmer,
} from '../utils/notificationRules/evaluation';

const DEFAULT_RULE_WINDOW = 10;

// [D-C5] these are presence-meaning reads: BSPC-marked absences are rows too
// under the merged model and must not count as attendance. NULL status
// (checked-in) is kept explicitly.
const NOT_ABSENT = 'status.is.null,status.neq.absent';

type SupportedTrigger = 'attendance_streak' | 'missed_practice';

interface AttendanceEventRow {
  id: string;
  swimmer_id: string;
  practice_date: string;
  practice_group: string | null;
  marked_by: string | null;
  swimmer: { display_name: string | null } | null;
}

interface NotificationRuleRow {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  config: { threshold?: number; group?: string; message?: string } | null;
  coach_id: string;
}

function uniquePracticeDates(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

async function fireRuleNotification(
  rule: NotificationRuleRow,
  attendance: AttendanceEventRow,
): Promise<void> {
  const swimmerName = attendance.swimmer?.display_name ?? '';
  const threshold = rule.config?.threshold ?? 1;
  const title = rule.name;
  const body =
    rule.config?.message?.trim() ||
    (rule.trigger === 'attendance_streak'
      ? `${swimmerName || 'Swimmer'} hit a ${threshold}-practice streak.`
      : `${swimmerName || 'Swimmer'} missed ${threshold} practice day${threshold === 1 ? '' : 's'}.`);

  // Recipient mapping [RG-7]: rules.coach_id is a profiles.id, but
  // in_app_notifications.user_id is an auth.users id. The rules were matched
  // on coach_id = the MARKER's profile, so the owner's auth user IS
  // attendance.marked_by — no second lookup needed.
  const { error } = await supabase.rpc('upsert_rule_notification', {
    p_user_id: attendance.marked_by,
    p_title: title,
    p_body: body,
    p_category: 'general',
    p_data: {
      swimmerId: attendance.swimmer_id,
      ruleId: rule.id,
      trigger: rule.trigger,
      evalDate: attendance.practice_date,
    },
    p_rule_id: rule.id,
    p_swimmer_id: attendance.swimmer_id,
    p_source_eval_date: attendance.practice_date,
  });
  if (error) throw new Error(`upsert_rule_notification failed: ${error.message}`);
}

async function evaluateAttendanceRow(attendanceId: string): Promise<void> {
  const { data } = await supabase
    .from('attendance')
    .select(
      'id, swimmer_id, practice_date, practice_group, marked_by, swimmer:swimmers(display_name)',
    )
    .eq('id', attendanceId)
    .maybeSingle();
  const attendance = data as unknown as AttendanceEventRow | null;

  // Row gone, or no marker to own rules — nothing to evaluate (the Firestore
  // trigger had the same markedBy guard).
  if (!attendance || !attendance.marked_by) return;

  const { data: markerProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', attendance.marked_by)
    .maybeSingle();
  if (!markerProfile) return;

  const { data: ruleRows } = await supabase
    .from('notification_rules')
    .select('id, name, trigger, enabled, config, coach_id')
    .eq('coach_id', (markerProfile as { id: string }).id)
    .eq('enabled', true);
  const rules = (ruleRows ?? []) as NotificationRuleRow[];
  if (rules.length === 0) return;

  for (const rule of rules) {
    const threshold = Math.max(rule.config?.threshold ?? 1, 1);

    if (
      !ruleAppliesToSwimmer(
        { enabled: rule.enabled, config: rule.config },
        { group: attendance.practice_group },
      )
    ) {
      continue;
    }

    if ((rule.trigger as SupportedTrigger) === 'missed_practice') {
      const { data: historyRows } = await supabase
        .from('attendance')
        .select('practice_date')
        .eq('swimmer_id', attendance.swimmer_id)
        .or(NOT_ABSENT)
        .order('practice_date', { ascending: false })
        .limit(2);

      const priorDate =
        ((historyRows ?? []) as { practice_date: string | null }[])
          .map((row) => row.practice_date ?? '')
          .find((date) => date !== attendance.practice_date) ?? null;

      if (evaluateMissedPracticeGap(priorDate, attendance.practice_date, threshold)) {
        await fireRuleNotification(rule, attendance);
      }
      continue;
    }

    if ((rule.trigger as SupportedTrigger) === 'attendance_streak') {
      const { data: recentRows } = await supabase
        .from('attendance')
        .select('practice_date')
        .eq('swimmer_id', attendance.swimmer_id)
        .or(NOT_ABSENT)
        .order('practice_date', { ascending: false })
        .limit(Math.max(DEFAULT_RULE_WINDOW, threshold + 2));
      const { data: windowRows } = await supabase
        .from('attendance')
        .select('practice_date')
        .or(NOT_ABSENT)
        .order('practice_date', { ascending: false })
        .limit(Math.max(DEFAULT_RULE_WINDOW, threshold + 5));

      // limit-then-unique preserved verbatim from the Firestore evaluator: the
      // window is N ROWS (not N distinct dates), then de-duplicated.
      const practiceHistory = uniquePracticeDates(
        ((recentRows ?? []) as { practice_date: string | null }[]).map(
          (row) => row.practice_date ?? '',
        ),
      );
      const allPracticeDates = uniquePracticeDates(
        ((windowRows ?? []) as { practice_date: string | null }[]).map(
          (row) => row.practice_date ?? '',
        ),
      );
      const streak = evaluateAttendanceStreakCount(practiceHistory, allPracticeDates);

      if (streak >= threshold) {
        await fireRuleNotification(rule, attendance);
      }
    }

    // Unimplemented triggers (pr_achieved, time_standard_met, birthday,
    // custom) behave exactly as they always have: they never fire.
  }
}

export async function evaluateAttendanceRowIds(attendanceIds: string[]): Promise<void> {
  for (const id of attendanceIds) {
    // error isolation: one bad row must not starve the rest of the batch
    await evaluateAttendanceRow(id).catch((err) =>
      console.error('evaluate attendance failed:', id, err),
    );
  }
}
