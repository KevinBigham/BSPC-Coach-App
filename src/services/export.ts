import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Swimmer, AttendanceRecord, SwimTime } from '../types/firestore.types';

type SwimmerWithId = Swimmer & { id: string };
type AttendanceWithId = AttendanceRecord & { id: string };
type TimeWithId = SwimTime & { id: string };

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function csvRow(values: string[]): string {
  return values.map(escapeCsv).join(',');
}

export function exportRosterCSV(swimmers: SwimmerWithId[]): string {
  const headers = [
    'First Name',
    'Last Name',
    'Display Name',
    'Group',
    'Gender',
    'Active',
    'USA Swimming ID',
    'Date of Birth',
  ];
  const rows = swimmers.map((s) =>
    csvRow([
      s.firstName,
      s.lastName,
      s.displayName,
      s.group,
      s.gender,
      s.active ? 'Yes' : 'No',
      s.usaSwimmingId || '',
      s.dateOfBirth instanceof Date
        ? s.dateOfBirth.toISOString().split('T')[0]
        : String(s.dateOfBirth || ''),
    ]),
  );
  return [csvRow(headers), ...rows].join('\n');
}

export function exportAttendanceCSV(records: AttendanceWithId[]): string {
  const headers = ['Swimmer', 'Group', 'Date', 'Arrived', 'Departed', 'Status', 'Note', 'Coach'];
  const rows = records.map((r) => {
    const arrived =
      r.arrivedAt instanceof Date
        ? r.arrivedAt.toLocaleTimeString()
        : typeof (r.arrivedAt as Record<string, unknown>)?.toDate === 'function'
          ? (r.arrivedAt as unknown as { toDate: () => Date }).toDate().toLocaleTimeString()
          : '';
    const departed =
      r.departedAt instanceof Date
        ? r.departedAt.toLocaleTimeString()
        : r.departedAt &&
            typeof (r.departedAt as unknown as Record<string, unknown>).toDate === 'function'
          ? (r.departedAt as unknown as { toDate: () => Date }).toDate().toLocaleTimeString()
          : '';
    return csvRow([
      r.swimmerName,
      r.group,
      r.practiceDate,
      arrived,
      departed,
      r.status || 'normal',
      r.note || '',
      r.coachName,
    ]);
  });
  return [csvRow(headers), ...rows].join('\n');
}

export function exportTimesCSV(times: TimeWithId[]): string {
  const headers = ['Event', 'Course', 'Time', 'Display', 'PR', 'Meet', 'Source', 'Date'];
  const rows = times.map((t) => {
    const date =
      t.createdAt instanceof Date
        ? t.createdAt.toISOString().split('T')[0]
        : typeof (t.createdAt as Record<string, unknown>)?.toDate === 'function'
          ? (t.createdAt as unknown as { toDate: () => Date }).toDate().toISOString().split('T')[0]
          : '';
    return csvRow([
      t.event,
      t.course,
      String(t.time),
      t.timeDisplay,
      t.isPR ? 'Yes' : 'No',
      t.meetName || '',
      t.source,
      date,
    ]);
  });
  return [csvRow(headers), ...rows].join('\n');
}

export async function shareCSV(filename: string, content: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: `Export ${filename}`,
      UTI: 'public.comma-separated-values-text',
    });
  }
}
