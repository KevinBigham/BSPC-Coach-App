import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Swimmer, SwimTime } from '../types/firestore.types';

type SwimmerWithId = Swimmer & { id: string };

// SDIF event code → app event name mapping
// SDIF uses distance + stroke code: e.g., "0050" + "A" = 50 Free
const STROKE_CODES: Record<string, string> = {
  A: 'Free',
  B: 'Back',
  C: 'Breast',
  D: 'Fly',
  E: 'IM',
};

const COURSE_CODES: Record<string, 'SCY' | 'SCM' | 'LCM'> = {
  Y: 'SCY',
  S: 'SCM',
  L: 'LCM',
  '1': 'SCY',
  '2': 'SCM',
  '3': 'LCM',
};

export interface SDIFRecord {
  firstName: string;
  lastName: string;
  usaSwimmingId: string;
  event: string;
  time: number; // hundredths
  timeDisplay: string;
  course: 'SCY' | 'SCM' | 'LCM';
  meetName: string;
  meetDate: string;
  gender: 'M' | 'F';
}

export interface SDIFParseResult {
  meetName: string;
  meetDate: string;
  course: 'SCY' | 'SCM' | 'LCM';
  records: SDIFRecord[];
  errors: string[];
}

export interface MatchResult {
  record: SDIFRecord;
  matchedSwimmer: SwimmerWithId | null;
  confidence: 'exact' | 'name' | 'none';
}

export interface ImportResult {
  imported: number;
  prs: number;
  skipped: number;
  errors: string[];
}

function parseSDIFTime(timeStr: string): { hundredths: number; display: string } | null {
  const cleaned = timeStr.trim();
  if (!cleaned || cleaned === 'NT' || cleaned === 'NS' || cleaned === 'DQ' || cleaned === 'SCR') {
    return null;
  }

  // Formats: "MM:SS.hh", "SS.hh", "M:SS.hh"
  const colonMatch = cleaned.match(/^(\d+):(\d{2})\.(\d{2})$/);
  if (colonMatch) {
    const min = parseInt(colonMatch[1]);
    const sec = parseInt(colonMatch[2]);
    const hund = parseInt(colonMatch[3]);
    const total = min * 6000 + sec * 100 + hund;
    return { hundredths: total, display: cleaned };
  }

  const secMatch = cleaned.match(/^(\d+)\.(\d{2})$/);
  if (secMatch) {
    const sec = parseInt(secMatch[1]);
    const hund = parseInt(secMatch[2]);
    const total = sec * 100 + hund;
    return { hundredths: total, display: cleaned };
  }

  return null;
}

function mapEventCode(distance: string, strokeCode: string): string | null {
  const dist = parseInt(distance);
  const stroke = STROKE_CODES[strokeCode];
  if (!stroke || !dist) return null;
  return `${dist} ${stroke}`;
}

export function parseSDIF(content: string): SDIFParseResult {
  const lines = content.split('\n');
  const result: SDIFParseResult = {
    meetName: '',
    meetDate: '',
    course: 'SCY',
    records: [],
    errors: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 2) continue;

    const recordType = line.substring(0, 2);

    try {
      if (recordType === 'B1') {
        // Meet info record
        result.meetName = line.substring(11, 41).trim();
        const dateStr = line.substring(41, 49).trim();
        if (dateStr.length === 8) {
          result.meetDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
        }
        const courseCode = line.substring(52, 53).trim();
        if (COURSE_CODES[courseCode]) {
          result.course = COURSE_CODES[courseCode];
        }
      } else if (recordType === 'D0') {
        // Individual event result record
        // SDIF D0 layout varies by version, but common layout:
        // 2: record type, 3-5: org code, 11-16: USS#, 17-28: swimmer name
        const ussId = line.substring(10, 24).trim();
        const nameField = line.substring(24, 52).trim();
        const genderChar = line.substring(52, 53).trim();
        const eventDistance = line.substring(56, 60).trim();
        const strokeCode = line.substring(60, 61).trim();
        const timeStr = line.substring(62, 70).trim();
        const courseCode = line.substring(70, 71).trim();

        // Parse name (Last, First or LAST,FIRST format)
        let firstName = '';
        let lastName = '';
        if (nameField.includes(',')) {
          const parts = nameField.split(',').map((s) => s.trim());
          lastName = parts[0];
          firstName = parts[1] || '';
        } else {
          const parts = nameField.split(/\s+/);
          lastName = parts[0] || '';
          firstName = parts.slice(1).join(' ');
        }

        const event = mapEventCode(eventDistance, strokeCode);
        if (!event) {
          result.errors.push(`Line ${i + 1}: Unknown event code ${eventDistance}${strokeCode}`);
          continue;
        }

        const parsedTime = parseSDIFTime(timeStr);
        if (!parsedTime) {
          // Skip NT/NS/DQ/SCR entries silently
          continue;
        }

        const course = COURSE_CODES[courseCode] || result.course;
        const gender = genderChar === 'F' ? 'F' : 'M';

        result.records.push({
          firstName: titleCase(firstName),
          lastName: titleCase(lastName),
          usaSwimmingId: ussId,
          event,
          time: parsedTime.hundredths,
          timeDisplay: parsedTime.display,
          course,
          meetName: result.meetName,
          meetDate: result.meetDate,
          gender,
        });
      }
    } catch (err) {
      result.errors.push(`Line ${i + 1}: Parse error`);
    }
  }

  return result;
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function matchSwimmers(records: SDIFRecord[], swimmers: SwimmerWithId[]): MatchResult[] {
  return records.map((record) => {
    // 1. Exact match on USA Swimming ID
    if (record.usaSwimmingId) {
      const exact = swimmers.find((s) => s.usaSwimmingId === record.usaSwimmingId);
      if (exact) {
        return { record, matchedSwimmer: exact, confidence: 'exact' as const };
      }
    }

    // 2. Name match (case-insensitive)
    const nameMatch = swimmers.find(
      (s) =>
        s.firstName.toLowerCase() === record.firstName.toLowerCase() &&
        s.lastName.toLowerCase() === record.lastName.toLowerCase(),
    );
    if (nameMatch) {
      return { record, matchedSwimmer: nameMatch, confidence: 'name' as const };
    }

    return { record, matchedSwimmer: null, confidence: 'none' as const };
  });
}

export async function importMeetResults(
  matches: MatchResult[],
  coachUid: string,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, prs: 0, skipped: 0, errors: [] };

  // Group matches by swimmer for efficient PR checking
  const bySwimmer = new Map<string, MatchResult[]>();
  for (const match of matches) {
    if (!match.matchedSwimmer) {
      result.skipped++;
      continue;
    }
    const key = match.matchedSwimmer.id!;
    if (!bySwimmer.has(key)) bySwimmer.set(key, []);
    bySwimmer.get(key)!.push(match);
  }

  for (const [swimmerId, swimmerMatches] of bySwimmer) {
    // Fetch existing times for PR comparison
    const timesRef = collection(db, 'swimmers', swimmerId, 'times');
    const existingSnap = await getDocs(timesRef);
    const existingTimes = existingSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as (SwimTime & { id: string })[];

    // Batch write in chunks of 400
    const chunks: MatchResult[][] = [];
    for (let i = 0; i < swimmerMatches.length; i += 400) {
      chunks.push(swimmerMatches.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);

      for (const match of chunk) {
        const rec = match.record;
        // Check if PR
        const sameTimes = existingTimes.filter(
          (t) => t.event === rec.event && t.course === rec.course,
        );
        const isPR = sameTimes.length === 0 || sameTimes.every((t) => rec.time < t.time);

        const newRef = doc(collection(db, 'swimmers', swimmerId, 'times'));
        batch.set(newRef, {
          event: rec.event,
          course: rec.course,
          time: rec.time,
          timeDisplay: rec.timeDisplay,
          isPR,
          meetName: rec.meetName || null,
          meetDate: rec.meetDate || null,
          source: 'sdif_import',
          createdAt: serverTimestamp(),
          createdBy: coachUid,
        });

        result.imported++;
        if (isPR) result.prs++;

        // If new PR, un-PR old ones
        if (isPR && sameTimes.length > 0) {
          for (const old of sameTimes) {
            if (old.isPR) {
              batch.update(doc(db, 'swimmers', swimmerId, 'times', old.id), { isPR: false });
            }
          }
        }
      }

      try {
        await batch.commit();
      } catch (err: unknown) {
        result.errors.push(
          `Batch write failed for swimmer ${swimmerId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return result;
}
