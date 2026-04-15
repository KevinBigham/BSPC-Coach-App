import { collection, query, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { GROUPS } from '../config/constants';
import { createImportJob, updateImportJob } from './importJobs';

const CSV_IMPORT_FILE_NAME = 'pasted-roster.csv';
const CSV_IMPORT_STORAGE_PATH = 'manual/pasted-roster.csv';

export interface ParsedRow {
  firstName: string;
  lastName: string;
  group: string;
  gender: string;
  dateOfBirth?: string;
  usaSwimmingId?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
}

export interface ValidationResult {
  valid: ParsedRow[];
  errors: string[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Parses CSV content into rows.
 * Expected header: firstName,lastName,group,gender,dateOfBirth,usaSwimmingId,parentName,parentPhone,parentEmail
 */
export function parseCSV(content: string): ParsedRow[] {
  const lines = content
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = (values[j] || '').trim();
    });

    rows.push({
      firstName: row['firstname'] || row['first name'] || row['first'] || '',
      lastName: row['lastname'] || row['last name'] || row['last'] || '',
      group: row['group'] || row['level'] || '',
      gender: row['gender'] || row['sex'] || '',
      dateOfBirth: row['dateofbirth'] || row['dob'] || row['date of birth'] || '',
      usaSwimmingId: row['usaswimmingid'] || row['usa swimming id'] || row['usaid'] || '',
      parentName: row['parentname'] || row['parent name'] || row['parent'] || '',
      parentPhone: row['parentphone'] || row['parent phone'] || row['phone'] || '',
      parentEmail: row['parentemail'] || row['parent email'] || row['email'] || '',
    });
  }

  return rows;
}

/** Handles quoted CSV fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Validates parsed rows */
export function validateRows(rows: ParsedRow[]): ValidationResult {
  const valid: ParsedRow[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const line = i + 2; // +2 for header + 0-index
    if (!row.firstName) {
      errors.push(`Row ${line}: Missing first name`);
      return;
    }
    if (!row.lastName) {
      errors.push(`Row ${line}: Missing last name`);
      return;
    }

    // Normalize group
    const matchedGroup = GROUPS.find((g) => g.toLowerCase() === row.group.toLowerCase());
    if (row.group && !matchedGroup) {
      errors.push(`Row ${line}: Invalid group "${row.group}" (valid: ${GROUPS.join(', ')})`);
      return;
    }

    // Normalize gender
    const g = row.gender.toUpperCase();
    if (row.gender && g !== 'M' && g !== 'F' && g !== 'MALE' && g !== 'FEMALE') {
      errors.push(`Row ${line}: Invalid gender "${row.gender}" (use M/F)`);
      return;
    }

    valid.push({
      ...row,
      group: matchedGroup || 'Bronze',
      gender: g === 'MALE' || g === 'M' ? 'M' : 'F',
    });
  });

  return { valid, errors };
}

/** Imports validated swimmers into Firestore, skipping duplicates */
export async function importSwimmers(rows: ParsedRow[], coachUid: string): Promise<ImportResult> {
  const importJobId = await createImportJob({
    type: 'csv_roster',
    fileName: CSV_IMPORT_FILE_NAME,
    storagePath: CSV_IMPORT_STORAGE_PATH,
    status: 'processing',
    summary: {
      recordsProcessed: rows.length,
      swimmersCreated: 0,
      swimmersUpdated: 0,
      timesImported: 0,
      errors: [],
    },
    coachId: coachUid,
  });

  try {
    // Fetch existing swimmers for duplicate detection
    const existing = await getDocs(query(collection(db, 'swimmers')));
    const existingKeys = new Set<string>();
    existing.forEach((d) => {
      const data = d.data();
      existingKeys.add(
        `${data.firstName?.toLowerCase()}|${data.lastName?.toLowerCase()}|${data.group?.toLowerCase()}`,
      );
    });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Batch in chunks of 400 (Firestore limit is 500, leaving room)
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      const batch = writeBatch(db);

      for (const row of chunk) {
        const key = `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}|${row.group.toLowerCase()}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        const ref = doc(collection(db, 'swimmers'));
        batch.set(ref, {
          firstName: row.firstName,
          lastName: row.lastName,
          displayName: `${row.firstName} ${row.lastName}`,
          group: row.group,
          gender: row.gender || 'F',
          dateOfBirth: row.dateOfBirth || null,
          usaSwimmingId: row.usaSwimmingId || null,
          active: true,
          strengths: [],
          weaknesses: [],
          techniqueFocusAreas: [],
          goals: [],
          parentContacts: row.parentName
            ? [
                {
                  name: row.parentName,
                  phone: row.parentPhone || '',
                  email: row.parentEmail || '',
                  relationship: 'Parent',
                },
              ]
            : [],
          meetSchedule: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: coachUid,
        });
        existingKeys.add(key);
        created++;
      }

      try {
        await batch.commit();
      } catch (err: unknown) {
        errors.push(`Batch error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await updateImportJob(importJobId, {
      status: 'complete',
      summary: {
        recordsProcessed: rows.length,
        swimmersCreated: created,
        swimmersUpdated: 0,
        timesImported: 0,
        errors,
      },
    });

    return { created, skipped, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Import failed';
    await updateImportJob(importJobId, {
      status: 'failed',
      errorMessage,
      summary: {
        recordsProcessed: rows.length,
        swimmersCreated: 0,
        swimmersUpdated: 0,
        timesImported: 0,
        errors: [errorMessage],
      },
    });
    throw error;
  }
}
