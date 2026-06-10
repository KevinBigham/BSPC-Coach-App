import { supabase } from '../config/supabase';
import { GROUPS } from '../config/constants';
import { createImportJob, updateImportJob } from './importJobs';
import { logger } from '../utils/logger';

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

/** Imports validated swimmers into canonical Postgres, skipping duplicates */
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
    const { data: existing, error: existingError } = await supabase
      .from('swimmers')
      .select('first_name, last_name, practice_group');
    if (existingError) throw existingError;
    const existingKeys = new Set<string>();
    (existing ?? []).forEach(
      (data: {
        first_name: string | null;
        last_name: string | null;
        practice_group: string | null;
      }) => {
        existingKeys.add(
          `${data.first_name?.toLowerCase()}|${data.last_name?.toLowerCase()}|${data.practice_group?.toLowerCase()}`,
        );
      },
    );

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Insert in chunks of 400 (kept from the Firestore batch limit; keeps
    // payload sizes bounded and one failed chunk from sinking the rest)
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      const swimmerRows: Record<string, unknown>[] = [];
      const contactsByIndex: Array<ParsedRow | null> = [];

      for (const row of chunk) {
        const key = `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}|${row.group.toLowerCase()}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        swimmerRows.push({
          first_name: row.firstName,
          last_name: row.lastName,
          display_name: `${row.firstName} ${row.lastName}`,
          practice_group: row.group,
          gender: row.gender || 'F',
          date_of_birth: row.dateOfBirth || null,
          usa_swimming_id: row.usaSwimmingId || null,
          is_active: true,
          created_by: coachUid,
          // created_at / updated_at owned by the DB
        });
        contactsByIndex.push(row.parentName ? row : null);
        existingKeys.add(key);
        created++;
      }

      if (swimmerRows.length === 0) continue;

      try {
        const { data: inserted, error: insertError } = await supabase
          .from('swimmers')
          .insert(swimmerRows)
          .select('id');
        if (insertError) throw insertError;

        // Coach-eyes companion rows: CSV parent contacts land on the
        // staff-only swimmer_coach_profile table, never on swimmers.
        const scpRows = (inserted ?? []).map((rec: { id: string }, idx: number) => {
          const source = contactsByIndex[idx];
          return {
            swimmer_id: rec.id,
            parent_contacts: source
              ? [
                  {
                    name: source.parentName,
                    phone: source.parentPhone || '',
                    email: source.parentEmail || '',
                    relationship: 'Parent',
                  },
                ]
              : [],
          };
        });
        if (scpRows.length > 0) {
          const { error: scpError } = await supabase.from('swimmer_coach_profile').insert(scpRows);
          if (scpError) throw scpError;
        }
      } catch (err: unknown) {
        // Intentionally swallowed: record the batch error and finish the import job summary.
        logger.error('csvImport:importSwimmers:batchCommitFail', {
          error: String(err),
          created,
          skipped,
        });
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
    logger.error('csvImport:importSwimmers:fail', {
      error: String(error),
      recordsProcessed: rows.length,
    });
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
