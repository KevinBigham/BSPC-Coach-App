import { parseSwimTimeString } from '../utils/time';
import type { SDIFParseResult } from './meetImportTypes';
import { logger } from '../utils/logger';

// Re-export shared meet-import types so existing callers can continue to
// import them from this module. The canonical definitions live in
// `./meetImportTypes` to avoid a runtime cycle with `meetResultsImport`.
export type { SDIFRecord, SDIFParseResult, MatchResult, ImportResult } from './meetImportTypes';

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

        const parsedTime = parseSwimTimeString(timeStr);
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
      // Intentionally swallowed: record the bad line and continue parsing the remaining file.
      logger.warn('sdifImport:parseSDIF:lineParseFail', {
        error: String(err),
        line: i + 1,
      });
      result.errors.push(`Line ${i + 1}: Parse error`);
    }
  }

  return result;
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Re-export the canonical roster matcher from meetResultsImport so existing
// callers (and tests) can import it from either module without diverging.
export { matchSwimmersToRoster as matchSwimmers } from './meetResultsImport';
