import type {
  AttendanceAggregation,
  AttendanceRecord,
  Swimmer,
  SwimmerAggregation,
  SwimmerGoal,
  SwimmerNote,
  SwimTime,
} from '../types/firestore.types';

export type DemoFactTone = 'neutral' | 'good' | 'warning' | 'danger' | 'accent';

export interface DemoFact {
  label: string;
  value?: string;
  tone: DemoFactTone;
  privacy?: 'COACH-ONLY' | 'PARENT-SAFE';
}

export interface ProfileCoachSnapshot {
  nextAction: DemoFact;
  todayStatus: DemoFact;
  recentNote: DemoFact;
  bestTime: DemoFact;
  attendanceCount: DemoFact;
  activeGoalCount: DemoFact;
  mediaSafety: DemoFact;
  parentBoundary: DemoFact;
}

export function getMediaSafetyFact(
  swimmer: Pick<Swimmer, 'doNotPhotograph' | 'mediaConsent'>,
): DemoFact {
  if (swimmer.doNotPhotograph) {
    return { label: 'DO NOT PHOTOGRAPH', tone: 'danger' };
  }

  if (swimmer.mediaConsent?.granted) {
    return { label: 'MEDIA OK', tone: 'good' };
  }

  if (swimmer.mediaConsent && !swimmer.mediaConsent.granted) {
    return { label: 'MEDIA BLOCKED', tone: 'danger' };
  }

  return { label: 'MEDIA CHECK', tone: 'warning' };
}

export function buildRosterDemoFacts(
  swimmer: Pick<Swimmer, 'active' | 'doNotPhotograph' | 'mediaConsent'>,
  attendanceAgg?: AttendanceAggregation,
  swimmerAgg?: SwimmerAggregation,
): DemoFact[] {
  const facts: DemoFact[] = [];

  if (!swimmer.active) {
    facts.push({ label: 'INACTIVE', tone: 'warning' });
  }

  facts.push(
    attendanceAgg
      ? {
          label: `30D ${Math.round(attendanceAgg.attendancePercent30)}%`,
          tone: 'good',
        }
      : {
          label: '30D --',
          tone: 'neutral',
        },
  );

  const prCount = swimmerAgg ? Object.keys(swimmerAgg.prsByEvent || {}).length : 0;
  if (prCount > 0) {
    facts.push({
      label: `${prCount} PR${prCount === 1 ? '' : 'S'}`,
      tone: 'accent',
    });
  }

  const mediaFact = getMediaSafetyFact(swimmer);
  if (mediaFact.tone !== 'good') {
    facts.push(mediaFact);
  }

  return facts;
}

export function buildProfileCoachSnapshot({
  swimmer,
  notes,
  times,
  attendance,
  goals,
  todayAttendance,
}: {
  swimmer: Swimmer;
  notes: (Pick<SwimmerNote, 'content'> & { id: string })[];
  times: (SwimTime & { id: string })[];
  attendance: (AttendanceRecord & { id: string })[];
  goals: (SwimmerGoal & { id: string })[];
  todayAttendance: (AttendanceRecord & { id: string }) | null;
}): ProfileCoachSnapshot {
  const bestTime = findBestTime(times);
  const activeGoalCount = goals.filter((goal) => !goal.achieved).length;
  const mediaSafety = getMediaSafetyFact(swimmer);

  return {
    nextAction: buildNextPracticeAction({
      mediaSafety,
      notes,
      todayAttendance,
      activeGoalCount,
    }),
    todayStatus: {
      label: 'TODAY',
      value: formatTodayStatus(todayAttendance),
      tone: todayAttendance ? getAttendanceTone(todayAttendance.status) : 'neutral',
    },
    recentNote: {
      label: 'LAST COACH NOTE',
      value: notes[0]?.content || 'No coach notes yet',
      tone: notes.length > 0 ? 'accent' : 'neutral',
      privacy: 'COACH-ONLY',
    },
    bestTime: {
      label: bestTime ? 'BEST CURRENT TIME' : 'BEST CURRENT TIME',
      value: bestTime
        ? `${bestTime.event} ${bestTime.timeDisplay} ${bestTime.course}`
        : 'No times recorded yet',
      tone: bestTime ? 'good' : 'neutral',
    },
    attendanceCount: {
      label: 'PRACTICE HISTORY',
      value:
        attendance.length === 1 ? '1 practice recorded' : `${attendance.length} practices recorded`,
      tone: attendance.length > 0 ? 'good' : 'neutral',
    },
    activeGoalCount: {
      label: 'ACTIVE GOALS',
      value: `${activeGoalCount} active`,
      tone: activeGoalCount > 0 ? 'accent' : 'neutral',
    },
    mediaSafety,
    parentBoundary: {
      label: 'PARENT PORTAL',
      value: 'Notes and AI drafts stay coach-only',
      tone: 'warning',
      privacy: 'COACH-ONLY',
    },
  };
}

function buildNextPracticeAction({
  mediaSafety,
  notes,
  todayAttendance,
  activeGoalCount,
}: {
  mediaSafety: DemoFact;
  notes: (Pick<SwimmerNote, 'content'> & { id: string })[];
  todayAttendance: (AttendanceRecord & { id: string }) | null;
  activeGoalCount: number;
}): DemoFact {
  if (mediaSafety.tone === 'danger') {
    return {
      label: 'NEXT ACTION',
      value: 'Use text-only coaching notes; do not tag media',
      tone: 'danger',
      privacy: 'COACH-ONLY',
    };
  }

  if (!todayAttendance) {
    return {
      label: 'NEXT ACTION',
      value: 'Confirm attendance before adding practice observations',
      tone: 'warning',
      privacy: 'COACH-ONLY',
    };
  }

  if (mediaSafety.tone === 'warning') {
    return {
      label: 'NEXT ACTION',
      value: 'Confirm media consent before video or audio tagging',
      tone: 'warning',
      privacy: 'COACH-ONLY',
    };
  }

  if (notes.length === 0) {
    return {
      label: 'NEXT ACTION',
      value: 'Add the first coach-only note from practice',
      tone: 'accent',
      privacy: 'COACH-ONLY',
    };
  }

  if (activeGoalCount > 0) {
    return {
      label: 'NEXT ACTION',
      value: 'Review active goal and add a practice note',
      tone: 'accent',
      privacy: 'COACH-ONLY',
    };
  }

  return {
    label: 'NEXT ACTION',
    value: 'Record a coach-only note or voice memo',
    tone: 'neutral',
    privacy: 'COACH-ONLY',
  };
}

function findBestTime(times: (SwimTime & { id: string })[]): (SwimTime & { id: string }) | null {
  if (times.length === 0) return null;

  const prs = times.filter((time) => time.isPR);
  const candidates = prs.length > 0 ? prs : times;
  return [...candidates].sort((left, right) => left.time - right.time)[0] || null;
}

function formatTodayStatus(record: (AttendanceRecord & { id: string }) | null): string {
  if (!record) return 'NO CHECK-IN';
  const status = record.status || 'normal';
  if (status === 'normal') return 'PRESENT';
  return status.replace('_', ' ').toUpperCase();
}

function getAttendanceTone(status: AttendanceRecord['status']): DemoFactTone {
  if (!status || status === 'normal') return 'good';
  if (status === 'left_early' || status === 'excused') return 'warning';
  if (status === 'sick' || status === 'injured') return 'danger';
  return 'neutral';
}
