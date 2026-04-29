import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import {
  evaluateAttendanceStreakCount,
  evaluateMissedPracticeGap,
  ruleAppliesToSwimmer,
} from '../utils/notificationRules/evaluation';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const DEFAULT_RULE_WINDOW = 10;

type SupportedTrigger = 'attendance_streak' | 'missed_practice';

interface AttendanceEventData {
  swimmerId: string;
  swimmerName?: string;
  group?: string;
  practiceDate: string;
  markedBy?: string;
}

interface NotificationRuleData {
  name: string;
  trigger: SupportedTrigger;
  enabled: boolean;
  config?: {
    threshold?: number;
    group?: string;
    message?: string;
  };
  coachId: string;
}

function uniquePracticeDates(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function buildNotificationId(ruleId: string, swimmerId: string, evalDate: string): string {
  return `rule_${ruleId}_${swimmerId}_${evalDate}`;
}

async function createRuleNotification(
  ruleId: string,
  rule: NotificationRuleData,
  attendance: AttendanceEventData,
): Promise<void> {
  const notificationId = buildNotificationId(ruleId, attendance.swimmerId, attendance.practiceDate);
  const title = rule.name;
  const body =
    rule.config?.message?.trim() ||
    (rule.trigger === 'attendance_streak'
      ? `${attendance.swimmerName || 'Swimmer'} hit a ${rule.config?.threshold ?? 1}-practice streak.`
      : `${attendance.swimmerName || 'Swimmer'} missed ${rule.config?.threshold ?? 1} practice day${(rule.config?.threshold ?? 1) === 1 ? '' : 's'}.`);

  await db
    .collection('notifications')
    .doc(notificationId)
    .set(
      {
        coachId: rule.coachId,
        title,
        body,
        type: 'general',
        data: {
          swimmerId: attendance.swimmerId,
          ruleId,
          trigger: rule.trigger,
          evalDate: attendance.practiceDate,
        },
        ruleId,
        swimmerId: attendance.swimmerId,
        evalDate: attendance.practiceDate,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function evaluateRulesForAttendance(attendance: AttendanceEventData): Promise<void> {
  if (!attendance.swimmerId || !attendance.practiceDate || !attendance.markedBy) {
    return;
  }

  const rulesSnap = await db
    .collection('notification_rules')
    .where('coachId', '==', attendance.markedBy)
    .where('enabled', '==', true)
    .get();

  if (rulesSnap.empty) {
    return;
  }

  for (const ruleDoc of rulesSnap.docs) {
    const rule = ruleDoc.data() as NotificationRuleData;
    const threshold = Math.max(rule.config?.threshold ?? 1, 1);

    if (
      !ruleAppliesToSwimmer(
        { enabled: rule.enabled, config: rule.config },
        { group: attendance.group },
      )
    ) {
      continue;
    }

    if (rule.trigger === 'missed_practice') {
      const historySnap = await db
        .collection('attendance')
        .where('swimmerId', '==', attendance.swimmerId)
        .orderBy('practiceDate', 'desc')
        .limit(2)
        .get();

      const priorDate =
        historySnap.docs
          .map((doc) => (doc.data().practiceDate as string | undefined) ?? '')
          .find((date) => date !== attendance.practiceDate) ?? null;

      if (evaluateMissedPracticeGap(priorDate, attendance.practiceDate, threshold)) {
        await createRuleNotification(ruleDoc.id, rule, attendance);
      }
      continue;
    }

    if (rule.trigger === 'attendance_streak') {
      const recentAttendanceSnap = await db
        .collection('attendance')
        .where('swimmerId', '==', attendance.swimmerId)
        .orderBy('practiceDate', 'desc')
        .limit(Math.max(DEFAULT_RULE_WINDOW, threshold + 2))
        .get();
      const practiceWindowSnap = await db
        .collection('attendance')
        .orderBy('practiceDate', 'desc')
        .limit(Math.max(DEFAULT_RULE_WINDOW, threshold + 5))
        .get();

      const practiceHistory = uniquePracticeDates(
        recentAttendanceSnap.docs.map(
          (doc) => (doc.data().practiceDate as string | undefined) ?? '',
        ),
      );
      const allPracticeDates = uniquePracticeDates(
        practiceWindowSnap.docs.map((doc) => (doc.data().practiceDate as string | undefined) ?? ''),
      );
      const streak = evaluateAttendanceStreakCount(practiceHistory, allPracticeDates);

      if (streak >= threshold) {
        await createRuleNotification(ruleDoc.id, rule, attendance);
      }
    }
  }
}

export const evaluateNotificationRules = onDocumentWritten('attendance/{attId}', async (event) => {
  const after = event.data?.after?.data() as AttendanceEventData | undefined;

  if (!after) {
    return;
  }

  await evaluateRulesForAttendance(after);
});
