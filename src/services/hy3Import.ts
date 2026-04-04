/**
 * Hy-Tek HY3 file parser for meet results import.
 *
 * HY3 is Hy-Tek Meet Manager's proprietary format with fixed-width records:
 * - A0: File descriptor
 * - B1: Meet info (name, dates, course)
 * - C1: Team info
 * - D0: Individual event result (swimmer name, event, time)
 * - D3: Split times
 * - E0: Relay event
 * - F0: Relay swimmer names
 *
 * Returns the same SDIFRecord shape so both parsers share the import pipeline.
 */

import type { SDIFRecord, SDIFParseResult } from './sdifImport';

// Hy-Tek event code mapping
// HY3 encodes events as numeric codes
const HY3_EVENT_MAP: Record<string, string> = {
  '1': '50 Free', '2': '100 Free', '3': '200 Free', '4': '500 Free',
  '5': '1000 Free', '6': '1650 Free',
  '7': '50 Back', '8': '100 Back', '9': '200 Back',
  '10': '50 Breast', '11': '100 Breast', '12': '200 Breast',
  '13': '50 Fly', '14': '100 Fly', '15': '200 Fly',
  '16': '100 IM', '17': '200 IM', '18': '400 IM',
};

const HY3_COURSE_MAP: Record<string, 'SCY' | 'SCM' | 'LCM'> = {
  Y: 'SCY', S: 'SCM', L: 'LCM',
  '1': 'SCY', '2': 'SCM', '3': 'LCM',
};

function parseHY3Time(timeStr: string): { hundredths: number; display: string } | null {
  const cleaned = timeStr.trim();
  if (!cleaned || cleaned === 'NT' || cleaned === 'NS' || cleaned === 'DQ' || cleaned === 'SCR' || cleaned === '0.00') {
    return null;
  }

  // HY3 times can be in formats: "MM:SS.hh", "SS.hh", "M:SS.hh"
  const colonMatch = cleaned.match(/^(\d+):(\d{2})\.(\d{2})$/);
  if (colonMatch) {
    const min = parseInt(colonMatch[1]);
    const sec = parseInt(colonMatch[2]);
    const hund = parseInt(colonMatch[3]);
    return { hundredths: min * 6000 + sec * 100 + hund, display: cleaned };
  }

  const secMatch = cleaned.match(/^(\d+)\.(\d{2})$/);
  if (secMatch) {
    const sec = parseInt(secMatch[1]);
    const hund = parseInt(secMatch[2]);
    return { hundredths: sec * 100 + hund, display: cleaned };
  }

  return null;
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseHY3(content: string): SDIFParseResult {
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
        // Meet info: name typically at cols 2-47, dates at 47-55
        result.meetName = line.substring(2, 47).trim();
        const dateStr = line.substring(47, 55).trim();
        if (dateStr.length >= 8) {
          // Format: MMDDYYYY or YYYYMMDD
          if (parseInt(dateStr.substring(0, 4)) > 1900) {
            result.meetDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          } else {
            result.meetDate = `${dateStr.substring(4, 8)}-${dateStr.substring(0, 2)}-${dateStr.substring(2, 4)}`;
          }
        }
        const courseCode = line.substring(55, 56).trim();
        if (HY3_COURSE_MAP[courseCode]) {
          result.course = HY3_COURSE_MAP[courseCode];
        }
      } else if (recordType === 'D0') {
        // Individual result record
        // Typical HY3 D0 layout (positions may vary slightly):
        // 2-3: event gender (M/F/X), 3-5: event number code
        // 8-36: swimmer name (Last, First MI)
        // 36-50: USS ID
        // 50-56: event code or distance
        // 56-64: final time
        // 64-65: course
        const genderChar = line.substring(2, 3).trim();
        const nameField = line.substring(8, 36).trim();
        const ussId = line.substring(36, 50).trim();
        const eventCodeStr = line.substring(50, 56).trim();
        const timeStr = line.substring(56, 64).trim();
        const courseCode = line.substring(64, 65).trim();

        // Parse name
        let firstName = '';
        let lastName = '';
        if (nameField.includes(',')) {
          const parts = nameField.split(',').map((s) => s.trim());
          lastName = parts[0];
          firstName = parts[1]?.split(/\s+/)[0] || '';
        } else {
          const parts = nameField.split(/\s+/);
          lastName = parts[0] || '';
          firstName = parts[1] || '';
        }

        // Map event
        const eventCode = eventCodeStr.replace(/^0+/, '');
        let event = HY3_EVENT_MAP[eventCode];
        if (!event) {
          // Try parsing as distance + stroke (e.g., "050A" = 50 Free)
          const distMatch = eventCodeStr.match(/^(\d+)\s*([A-E])/);
          if (distMatch) {
            const dist = parseInt(distMatch[1]);
            const strokeMap: Record<string, string> = { A: 'Free', B: 'Back', C: 'Breast', D: 'Fly', E: 'IM' };
            const stroke = strokeMap[distMatch[2]];
            if (stroke && dist) event = `${dist} ${stroke}`;
          }
        }

        if (!event) {
          result.errors.push(`Line ${i + 1}: Unknown event code "${eventCodeStr}"`);
          continue;
        }

        const parsedTime = parseHY3Time(timeStr);
        if (!parsedTime) continue; // Skip NT/DQ/SCR silently

        const course = HY3_COURSE_MAP[courseCode] || result.course;
        const gender = genderChar === 'F' ? 'F' : 'M';

        result.records.push({
          firstName: titleCase(firstName),
          lastName: titleCase(lastName),
          usaSwimmingId: ussId.replace(/[^A-Za-z0-9]/g, ''),
          event,
          time: parsedTime.hundredths,
          timeDisplay: parsedTime.display,
          course,
          meetName: result.meetName,
          meetDate: result.meetDate,
          gender,
        });
      }
    } catch {
      result.errors.push(`Line ${i + 1}: Parse error`);
    }
  }

  return result;
}

/**
 * Auto-detect file format based on content.
 * HY3 files typically start with "A0" record.
 * SDIF files typically start with "A0" or "B1" but with different column layouts.
 * This is a heuristic — if in doubt, user can manually select format.
 */
export function detectFormat(content: string): 'sdif' | 'hy3' {
  const firstLine = content.split('\n')[0] || '';
  // HY3 files typically have ";HY3" or "HY-TEK" in the first record
  if (firstLine.includes('HY3') || firstLine.includes('HYTEK') || firstLine.includes('HY-TEK')) {
    return 'hy3';
  }
  // SDIF files have standard record identifiers
  if (firstLine.startsWith('A0') && firstLine.length > 50) {
    const orgCode = firstLine.substring(2, 4).trim();
    if (orgCode === 'US' || orgCode === 'UN') return 'sdif';
  }
  // Default to SDIF for .sd3/.cl2 files, HY3 for others
  return 'sdif';
}
