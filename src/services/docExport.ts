import type {
  PracticePlan,
  PracticePlanSet,
  PracticePlanItem,
  Swimmer,
  SwimTime,
  AttendanceRecord,
} from '../types/firestore.types';
import type { Group } from '../config/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEPARATOR = '='.repeat(60);
const SUB_SEPARATOR = '-'.repeat(40);

function header(text: string): string {
  return `${SEPARATOR}\n${text.toUpperCase()}\n${SEPARATOR}`;
}

function subHeader(text: string): string {
  return `${SUB_SEPARATOR}\n${text}\n${SUB_SEPARATOR}`;
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return 'N/A';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatItemLine(item: PracticePlanItem): string {
  const repsStr = item.reps > 1 ? `${item.reps} x ` : '';
  const intervalStr = item.interval ? ` on ${item.interval}` : '';
  const line = `  ${repsStr}${item.distance} ${item.stroke}${intervalStr}`;
  const parts: string[] = [line];
  if (item.description) {
    parts.push(`    ${item.description}`);
  }
  if (item.focusPoints.length > 0) {
    parts.push(`    Focus: ${item.focusPoints.join(', ')}`);
  }
  return parts.join('\n');
}

function formatSetYardage(set: PracticePlanSet): number {
  return set.items.reduce((sum, item) => sum + item.reps * item.distance, 0);
}

function formatTimeDisplay(time: number): string {
  const minutes = Math.floor(time / 6000);
  const seconds = Math.floor((time % 6000) / 100);
  const hundredths = time % 100;
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  }
  return `${seconds}.${hundredths.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Practice Plan Document
// ---------------------------------------------------------------------------

export function generatePracticePlanDoc(plan: PracticePlan): string {
  const lines: string[] = [];

  lines.push(header(plan.title));
  lines.push('');

  if (plan.date) {
    lines.push(`Date: ${formatDate(plan.date)}`);
  }
  if (plan.group) {
    lines.push(`Group: ${plan.group}`);
  }
  lines.push(`Coach: ${plan.coachName}`);
  lines.push(`Duration: ${plan.totalDuration} minutes`);
  if (plan.description) {
    lines.push(`Description: ${plan.description}`);
  }

  const totalYardage = plan.sets.reduce((sum, set) => sum + formatSetYardage(set), 0);
  lines.push(`Total Yardage: ${totalYardage}`);
  lines.push('');

  const sortedSets = [...plan.sets].sort((a, b) => a.order - b.order);

  for (const set of sortedSets) {
    const setYardage = formatSetYardage(set);
    lines.push(subHeader(`${set.name} [${set.category}] - ${setYardage} yds`));

    if (set.description) {
      lines.push(`  ${set.description}`);
    }

    const sortedItems = [...set.items].sort((a, b) => a.order - b.order);
    for (const item of sortedItems) {
      lines.push(formatItemLine(item));
    }
    lines.push('');
  }

  lines.push(SEPARATOR);
  lines.push(`Generated: ${formatDate(new Date())}`);
  lines.push('Blue Springs Power Cats');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Swimmer Report
// ---------------------------------------------------------------------------

export function generateSwimmerReport(
  swimmer: Swimmer,
  times: SwimTime[],
  attendance: AttendanceRecord[],
): string {
  const lines: string[] = [];

  lines.push(header(`Swimmer Report: ${swimmer.displayName}`));
  lines.push('');

  lines.push(subHeader('Profile'));
  lines.push(`Name: ${swimmer.firstName} ${swimmer.lastName}`);
  lines.push(`Group: ${swimmer.group}`);
  lines.push(`Gender: ${swimmer.gender === 'M' ? 'Male' : 'Female'}`);
  lines.push(`Status: ${swimmer.active ? 'Active' : 'Inactive'}`);
  if (swimmer.usaSwimmingId) {
    lines.push(`USA Swimming ID: ${swimmer.usaSwimmingId}`);
  }
  lines.push('');

  if (swimmer.strengths.length > 0) {
    lines.push('Strengths:');
    for (const s of swimmer.strengths) {
      lines.push(`  - ${s}`);
    }
  }
  if (swimmer.weaknesses.length > 0) {
    lines.push('Weaknesses:');
    for (const w of swimmer.weaknesses) {
      lines.push(`  - ${w}`);
    }
  }
  if (swimmer.techniqueFocusAreas.length > 0) {
    lines.push('Focus Areas:');
    for (const f of swimmer.techniqueFocusAreas) {
      lines.push(`  - ${f}`);
    }
  }
  if (swimmer.goals.length > 0) {
    lines.push('Goals:');
    for (const g of swimmer.goals) {
      lines.push(`  - ${g}`);
    }
  }
  lines.push('');

  lines.push(subHeader('Best Times'));
  if (times.length === 0) {
    lines.push('  No times recorded.');
  } else {
    const prsByEvent = new Map<string, SwimTime>();
    for (const t of times) {
      const key = `${t.event} (${t.course})`;
      const existing = prsByEvent.get(key);
      if (!existing || t.time < existing.time) {
        prsByEvent.set(key, t);
      }
    }

    for (const [event, t] of prsByEvent) {
      const meetStr = t.meetName ? ` @ ${t.meetName}` : '';
      const dateStr = t.meetDate ? ` (${formatDate(t.meetDate)})` : '';
      lines.push(`  ${event}: ${t.timeDisplay}${meetStr}${dateStr}`);
    }
  }
  lines.push('');

  lines.push(subHeader('Time History'));
  if (times.length === 0) {
    lines.push('  No times recorded.');
  } else {
    const sorted = [...times].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (const t of sorted) {
      const prTag = t.isPR ? ' [PR]' : '';
      const meetStr = t.meetName ? ` @ ${t.meetName}` : '';
      lines.push(`  ${t.event} (${t.course}): ${t.timeDisplay}${prTag}${meetStr}`);
    }
  }
  lines.push('');

  lines.push(subHeader('Attendance'));
  if (attendance.length === 0) {
    lines.push('  No attendance records.');
  } else {
    const total = attendance.length;
    const normalCount = attendance.filter((a) => !a.status || a.status === 'normal').length;
    const excusedCount = attendance.filter((a) => a.status === 'excused').length;
    const sickCount = attendance.filter((a) => a.status === 'sick').length;
    const injuredCount = attendance.filter((a) => a.status === 'injured').length;

    lines.push(`  Total Practices Attended: ${total}`);
    lines.push(`  Normal: ${normalCount}`);
    if (excusedCount > 0) lines.push(`  Excused: ${excusedCount}`);
    if (sickCount > 0) lines.push(`  Sick: ${sickCount}`);
    if (injuredCount > 0) lines.push(`  Injured: ${injuredCount}`);

    const recentDates = [...attendance]
      .sort((a, b) => b.practiceDate.localeCompare(a.practiceDate))
      .slice(0, 5);
    lines.push('');
    lines.push('  Recent:');
    for (const a of recentDates) {
      const statusStr = a.status && a.status !== 'normal' ? ` (${a.status})` : '';
      lines.push(`    ${a.practiceDate}${statusStr}`);
    }
  }
  lines.push('');

  if (swimmer.parentContacts.length > 0) {
    lines.push(subHeader('Parent Contacts'));
    for (const pc of swimmer.parentContacts) {
      lines.push(`  ${pc.name} (${pc.relationship})`);
      lines.push(`    Email: ${pc.email}`);
      lines.push(`    Phone: ${pc.phone}`);
    }
    lines.push('');
  }

  lines.push(SEPARATOR);
  lines.push(`Generated: ${formatDate(new Date())}`);
  lines.push('Blue Springs Power Cats');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Group Report
// ---------------------------------------------------------------------------

export interface GroupReportStats {
  totalPractices: number;
  averageAttendance: number;
  attendancePercent: number;
}

export function generateGroupReport(
  group: Group,
  swimmers: Swimmer[],
  stats: GroupReportStats,
): string {
  const lines: string[] = [];

  lines.push(header(`Group Report: ${group}`));
  lines.push('');

  lines.push(subHeader('Summary'));
  lines.push(`Group: ${group}`);
  lines.push(`Total Swimmers: ${swimmers.length}`);
  lines.push(`Active Swimmers: ${swimmers.filter((s) => s.active).length}`);
  lines.push(`Inactive Swimmers: ${swimmers.filter((s) => !s.active).length}`);
  lines.push('');

  lines.push(subHeader('Attendance'));
  lines.push(`Total Practices: ${stats.totalPractices}`);
  lines.push(`Average Attendance: ${stats.averageAttendance.toFixed(1)}`);
  lines.push(`Attendance Rate: ${stats.attendancePercent.toFixed(1)}%`);
  lines.push('');

  lines.push(subHeader('Roster'));
  if (swimmers.length === 0) {
    lines.push('  No swimmers in this group.');
  } else {
    const sorted = [...swimmers].sort((a, b) => a.lastName.localeCompare(b.lastName));
    for (const s of sorted) {
      const statusStr = s.active ? '' : ' [Inactive]';
      lines.push(`  ${s.lastName}, ${s.firstName}${statusStr}`);
    }
  }
  lines.push('');

  const males = swimmers.filter((s) => s.gender === 'M').length;
  const females = swimmers.filter((s) => s.gender === 'F').length;
  lines.push(subHeader('Demographics'));
  lines.push(`Male: ${males}`);
  lines.push(`Female: ${females}`);
  lines.push('');

  lines.push(SEPARATOR);
  lines.push(`Generated: ${formatDate(new Date())}`);
  lines.push('Blue Springs Power Cats');

  return lines.join('\n');
}
