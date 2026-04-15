import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Group } from '../config/constants';

// ── Time Drop Analysis ──────────────────────────────────────────────────

export interface TimeDrop {
  swimmerId: string;
  swimmerName: string;
  event: string;
  course: string;
  oldTime: number;
  newTime: number;
  dropHundredths: number;
  dropPercent: number;
  date: Date;
}

export async function getTimeDrops(
  options: {
    swimmerId?: string;
    group?: Group;
    rangeStart?: string; // "YYYY-MM-DD"
    rangeEnd?: string;
    maxResults?: number;
  } = {},
): Promise<TimeDrop[]> {
  const { swimmerId, group, rangeStart, rangeEnd, maxResults = 100 } = options;

  if (swimmerId) {
    return getSwimmerTimeDrops(swimmerId, rangeStart, rangeEnd);
  }

  const swimmerSnap = await getDocs(
    query(
      collection(db, 'swimmers'),
      where('active', '==', true),
      ...(group ? [where('group', '==', group)] : []),
    ),
  );

  const allDrops: TimeDrop[] = [];
  for (const swimmerDoc of swimmerSnap.docs) {
    const data = swimmerDoc.data();
    const drops = await getSwimmerTimeDrops(swimmerDoc.id, rangeStart, rangeEnd);
    for (const drop of drops) {
      drop.swimmerName = `${data.firstName} ${data.lastName}`;
      allDrops.push(drop);
    }
  }

  return allDrops.sort((a, b) => b.dropPercent - a.dropPercent).slice(0, maxResults);
}

async function getSwimmerTimeDrops(
  swimmerId: string,
  rangeStart?: string,
  rangeEnd?: string,
): Promise<TimeDrop[]> {
  const timesRef = collection(db, 'swimmers', swimmerId, 'times');
  const q = query(timesRef, orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);

  const bestByEvent: Record<string, number> = {};
  const drops: TimeDrop[] = [];

  for (const d of snap.docs) {
    const data = d.data();
    const key = `${data.event}_${data.course}`;
    const time = data.time as number;
    const created = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();

    if (rangeStart && created < new Date(rangeStart)) {
      bestByEvent[key] = Math.min(bestByEvent[key] ?? Infinity, time);
      continue;
    }
    if (rangeEnd && created > new Date(rangeEnd)) continue;

    if (bestByEvent[key] !== undefined && time < bestByEvent[key]) {
      drops.push({
        swimmerId,
        swimmerName: '',
        event: data.event,
        course: data.course,
        oldTime: bestByEvent[key],
        newTime: time,
        dropHundredths: bestByEvent[key] - time,
        dropPercent: ((bestByEvent[key] - time) / bestByEvent[key]) * 100,
        date: created,
      });
    }

    bestByEvent[key] = Math.min(bestByEvent[key] ?? Infinity, time);
  }

  return drops;
}

// ── Attendance Correlation ──────────────────────────────────────────────

export interface AttendanceCorrelation {
  swimmerId: string;
  swimmerName: string;
  group: string;
  attendancePercent: number;
  practiceCount: number;
  timeDropPercent: number; // average % improvement
  prCount: number;
}

export async function getAttendanceCorrelation(
  group?: Group,
  rangeDays = 90,
): Promise<AttendanceCorrelation[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const swimmerSnap = await getDocs(
    query(
      collection(db, 'swimmers'),
      where('active', '==', true),
      ...(group ? [where('group', '==', group)] : []),
    ),
  );

  const attendanceSnap = await getDocs(
    query(
      collection(db, 'attendance'),
      where('practiceDate', '>=', cutoffStr),
      orderBy('practiceDate', 'desc'),
    ),
  );

  const attendanceBySwimmer: Record<string, number> = {};
  for (const d of attendanceSnap.docs) {
    const sid = d.data().swimmerId as string;
    attendanceBySwimmer[sid] = (attendanceBySwimmer[sid] || 0) + 1;
  }

  // Denominator = distinct practice dates, not total records.
  const uniqueDates = new Set(attendanceSnap.docs.map((d) => d.data().practiceDate));
  const totalPractices = Math.max(uniqueDates.size, 1);

  const results: AttendanceCorrelation[] = [];

  for (const swimmerDoc of swimmerSnap.docs) {
    const data = swimmerDoc.data();
    const sid = swimmerDoc.id;
    const count = attendanceBySwimmer[sid] || 0;

    const drops = await getSwimmerTimeDrops(sid, cutoffStr);
    const avgDrop =
      drops.length > 0 ? drops.reduce((sum, d) => sum + d.dropPercent, 0) / drops.length : 0;

    results.push({
      swimmerId: sid,
      swimmerName: `${data.firstName} ${data.lastName}`,
      group: data.group,
      attendancePercent: (count / totalPractices) * 100,
      practiceCount: count,
      timeDropPercent: avgDrop,
      prCount: drops.length,
    });
  }

  return results.sort((a, b) => b.attendancePercent - a.attendancePercent);
}

// ── Group Progress Report ───────────────────────────────────────────────

export interface GroupProgressReport {
  group: string;
  swimmerCount: number;
  avgAttendancePercent: number;
  totalTimeDrops: number;
  avgTimeDropPercent: number;
  topDroppers: { name: string; dropPercent: number }[];
}

export async function getGroupProgressReport(
  group: Group,
  rangeDays = 90,
): Promise<GroupProgressReport> {
  const correlations = await getAttendanceCorrelation(group, rangeDays);

  const swimmerCount = correlations.length;
  const avgAttendance =
    swimmerCount > 0 ? correlations.reduce((s, c) => s + c.attendancePercent, 0) / swimmerCount : 0;
  const totalDrops = correlations.reduce((s, c) => s + c.prCount, 0);
  const droppersOnly = correlations.filter((c) => c.timeDropPercent > 0);
  const avgDrop =
    droppersOnly.length > 0
      ? droppersOnly.reduce((s, c) => s + c.timeDropPercent, 0) / droppersOnly.length
      : 0;

  const topDroppers = correlations
    .filter((c) => c.timeDropPercent > 0)
    .sort((a, b) => b.timeDropPercent - a.timeDropPercent)
    .slice(0, 5)
    .map((c) => ({ name: c.swimmerName, dropPercent: c.timeDropPercent }));

  return {
    group,
    swimmerCount,
    avgAttendancePercent: avgAttendance,
    totalTimeDrops: totalDrops,
    avgTimeDropPercent: avgDrop,
    topDroppers,
  };
}

// ── Formatting Helpers ──────────────────────────────────────────────────

export function formatTime(hundredths: number): string {
  const mins = Math.floor(hundredths / 6000);
  const secs = Math.floor((hundredths % 6000) / 100);
  const hs = hundredths % 100;
  if (mins > 0)
    return `${mins}:${secs.toString().padStart(2, '0')}.${hs.toString().padStart(2, '0')}`;
  return `${secs}.${hs.toString().padStart(2, '0')}`;
}

export function formatDropPercent(pct: number): string {
  return pct.toFixed(1) + '%';
}
