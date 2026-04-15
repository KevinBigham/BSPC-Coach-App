import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type {
  PracticePlan,
  PracticePlanSet,
  Swimmer,
  SwimTime,
  AttendanceRecord,
} from '../types/firestore.types';
import type { Group } from '../config/constants';
import type { GroupReportStats } from './docExport';

const BSPC_PURPLE = 'B388FF';
const BSPC_GOLD = 'FFD700';

function brandHeader(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({
        text: 'BLUE SPRINGS POWER CATS',
        bold: true,
        size: 20,
        color: BSPC_GOLD,
        font: 'Arial',
      }),
    ],
  });
}

function titleParagraph(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 36,
        color: BSPC_PURPLE,
        font: 'Arial',
      }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: BSPC_PURPLE },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 24,
        color: BSPC_PURPLE,
        font: 'Arial',
      }),
    ],
  });
}

function textLine(text: string, bold = false): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({
        text,
        bold,
        size: 20,
        font: 'Arial',
      }),
    ],
  });
}

function bulletItem(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 20, font: 'Arial' })],
  });
}

function formatSetYardage(set: PracticePlanSet): number {
  return set.items.reduce((sum, item) => sum + item.reps * item.distance, 0);
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return 'N/A';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function footer(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [
      new TextRun({
        text: `Generated: ${formatDate(new Date())} | Blue Springs Power Cats`,
        size: 16,
        color: '888888',
        font: 'Arial',
        italics: true,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Practice Plan DOCX
// ---------------------------------------------------------------------------

export async function exportPracticePlanDocx(
  plan: Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const totalYardage = plan.sets.reduce((sum, set) => sum + formatSetYardage(set), 0);
  const sortedSets = [...plan.sets].sort((a, b) => a.order - b.order);

  const children: Paragraph[] = [brandHeader('BSPC'), titleParagraph(plan.title)];

  if (plan.date) children.push(textLine(`Date: ${formatDate(plan.date)}`));
  if (plan.group) children.push(textLine(`Group: ${plan.group}`));
  children.push(textLine(`Coach: ${plan.coachName}`));
  children.push(textLine(`Duration: ${plan.totalDuration} minutes`));
  children.push(textLine(`Total Yardage: ${totalYardage}`, true));
  if (plan.description) children.push(textLine(plan.description));

  for (const set of sortedSets) {
    const setYardage = formatSetYardage(set);
    children.push(sectionHeading(`${set.name} [${set.category}] — ${setYardage} yds`));
    if (set.description) children.push(textLine(set.description));

    const sortedItems = [...set.items].sort((a, b) => a.order - b.order);
    for (const item of sortedItems) {
      const repsStr = item.reps > 1 ? `${item.reps} x ` : '';
      const intervalStr = item.interval ? ` on ${item.interval}` : '';
      children.push(bulletItem(`${repsStr}${item.distance} ${item.stroke}${intervalStr}`));
      if (item.description) {
        children.push(textLine(`    ${item.description}`));
      }
      if (item.focusPoints.length > 0) {
        children.push(textLine(`    Focus: ${item.focusPoints.join(', ')}`));
      }
    }
  }

  children.push(footer());

  const doc = new Document({ sections: [{ children }] });
  await shareDocx(doc, `practice-${plan.title.replace(/\s+/g, '-').toLowerCase()}.docx`);
}

// ---------------------------------------------------------------------------
// Swimmer Report DOCX
// ---------------------------------------------------------------------------

export async function exportSwimmerReportDocx(
  swimmer: Swimmer,
  times: SwimTime[],
  attendance: AttendanceRecord[],
): Promise<void> {
  const children: Paragraph[] = [
    brandHeader('BSPC'),
    titleParagraph(`Swimmer Report: ${swimmer.displayName}`),
  ];

  // Profile
  children.push(sectionHeading('Profile'));
  children.push(textLine(`Name: ${swimmer.firstName} ${swimmer.lastName}`));
  children.push(textLine(`Group: ${swimmer.group}`));
  children.push(textLine(`Gender: ${swimmer.gender === 'M' ? 'Male' : 'Female'}`));
  children.push(textLine(`Status: ${swimmer.active ? 'Active' : 'Inactive'}`));
  if (swimmer.usaSwimmingId) children.push(textLine(`USA Swimming ID: ${swimmer.usaSwimmingId}`));

  if (swimmer.strengths.length > 0) {
    children.push(textLine('Strengths:', true));
    for (const s of swimmer.strengths) children.push(bulletItem(s));
  }
  if (swimmer.goals.length > 0) {
    children.push(textLine('Goals:', true));
    for (const g of swimmer.goals) children.push(bulletItem(g));
  }
  if (swimmer.techniqueFocusAreas.length > 0) {
    children.push(textLine('Focus Areas:', true));
    for (const f of swimmer.techniqueFocusAreas) children.push(bulletItem(f));
  }

  // Best Times
  children.push(sectionHeading('Best Times'));
  if (times.length === 0) {
    children.push(textLine('No times recorded.'));
  } else {
    const prsByEvent = new Map<string, SwimTime>();
    for (const t of times) {
      const key = `${t.event} (${t.course})`;
      const existing = prsByEvent.get(key);
      if (!existing || t.time < existing.time) prsByEvent.set(key, t);
    }
    for (const [event, t] of prsByEvent) {
      const meetStr = t.meetName ? ` @ ${t.meetName}` : '';
      children.push(bulletItem(`${event}: ${t.timeDisplay}${meetStr}`));
    }
  }

  // Attendance
  children.push(sectionHeading('Attendance'));
  if (attendance.length === 0) {
    children.push(textLine('No attendance records.'));
  } else {
    const total = attendance.length;
    const normalCount = attendance.filter((a) => !a.status || a.status === 'normal').length;
    children.push(textLine(`Total Practices Attended: ${total}`));
    children.push(textLine(`Normal: ${normalCount}`));
  }

  children.push(footer());

  const doc = new Document({ sections: [{ children }] });
  await shareDocx(doc, `report-${swimmer.displayName.replace(/\s+/g, '-').toLowerCase()}.docx`);
}

// ---------------------------------------------------------------------------
// Group Report DOCX
// ---------------------------------------------------------------------------

export async function exportGroupReportDocx(
  group: Group,
  swimmers: Swimmer[],
  stats: GroupReportStats,
): Promise<void> {
  const children: Paragraph[] = [brandHeader('BSPC'), titleParagraph(`Group Report: ${group}`)];

  children.push(sectionHeading('Summary'));
  children.push(textLine(`Group: ${group}`));
  children.push(textLine(`Total Swimmers: ${swimmers.length}`));
  children.push(textLine(`Active: ${swimmers.filter((s) => s.active).length}`));

  children.push(sectionHeading('Attendance'));
  children.push(textLine(`Total Practices: ${stats.totalPractices}`));
  children.push(textLine(`Average Attendance: ${stats.averageAttendance.toFixed(1)}`));
  children.push(textLine(`Attendance Rate: ${stats.attendancePercent.toFixed(1)}%`));

  children.push(sectionHeading('Roster'));
  const sorted = [...swimmers].sort((a, b) => a.lastName.localeCompare(b.lastName));
  for (const s of sorted) {
    const statusStr = s.active ? '' : ' [Inactive]';
    children.push(bulletItem(`${s.lastName}, ${s.firstName}${statusStr}`));
  }

  children.push(footer());

  const doc = new Document({ sections: [{ children }] });
  await shareDocx(doc, `group-${group.toLowerCase()}.docx`);
}

// ---------------------------------------------------------------------------
// Share Helper
// ---------------------------------------------------------------------------

async function shareDocx(doc: Document, filename: string): Promise<void> {
  const blob = await Packer.toBlob(doc);
  const buffer = await blob.arrayBuffer();
  const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dialogTitle: filename,
  });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
