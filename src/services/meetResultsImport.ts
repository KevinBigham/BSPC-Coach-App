/**
 * Shared meet results import logic used by both SDIF and HY3 parsers.
 * Handles swimmer matching and result writes.
 *
 * Phase D split (UNIFY/08 §5d, the ratified csvImport pattern): the TIMES
 * half writes to Supabase swim_results — plain chunked INSERTs; the
 * maintain_personal_bests() trigger does ALL PR math (D-D5), so the
 * per-batch un-PR loop is gone and `result.prs` is recounted from the
 * post-insert is_personal_best truth (RD-9). The meets/{id}/entries
 * finalTime sync stays on Firestore until Phase H; import_jobs bookkeeping
 * stays on Firestore until its phase.
 */

import { collection, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { supabase } from '../config/supabase';
import type { Swimmer } from '../types/firestore.types';
import type { SDIFRecord, MatchResult, ImportResult } from './meetImportTypes';
import { createImportJob, updateImportJob } from './importJobs';
import { logger } from '../utils/logger';

type SwimmerWithId = Swimmer & { id: string };
type ImportSource = 'sdif_import' | 'hy3_import';

interface MeetImportJobMetadata {
  fileName: string;
  storagePath: string;
}

/**
 * Match parsed records to roster swimmers by USS ID or name.
 */
export function matchSwimmersToRoster(
  records: SDIFRecord[],
  swimmers: SwimmerWithId[],
): MatchResult[] {
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

/**
 * Import matched results into swim_results.
 * Optionally updates MeetEntry documents when meetId is provided (Firestore
 * until Phase H).
 */
export async function importMatchedResults(
  matches: MatchResult[],
  coachUid: string,
  source: ImportSource = 'sdif_import',
  meetId?: string,
  importJobMetadata?: MeetImportJobMetadata,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, prs: 0, skipped: 0, errors: [] };
  const importJobId = await createImportJob({
    type: source === 'hy3_import' ? 'hy3' : 'sdif',
    fileName:
      importJobMetadata?.fileName ??
      (source === 'hy3_import' ? 'manual-meet-results.hy3' : 'manual-meet-results.sdif'),
    storagePath:
      importJobMetadata?.storagePath ??
      (source === 'hy3_import' ? 'manual/meet-results.hy3' : 'manual/meet-results.sdif'),
    status: 'processing',
    summary: {
      recordsProcessed: matches.length,
      swimmersCreated: 0,
      swimmersUpdated: 0,
      timesImported: 0,
      errors: [],
    },
    coachId: coachUid,
  });

  try {
    // Group matches by swimmer
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
      // Insert in chunks of 400; per-swimmer error capture semantics preserved.
      // No existing-times read and no un-PR writes: the trigger owns PR truth.
      const chunks: MatchResult[][] = [];
      for (let i = 0; i < swimmerMatches.length; i += 400) {
        chunks.push(swimmerMatches.slice(i, i + 400));
      }

      const insertedIds: string[] = [];
      for (const chunk of chunks) {
        const rows = chunk.map(({ record: rec }) => ({
          swimmer_id: swimmerId,
          event_name: rec.event,
          course: rec.course,
          time_hundredths: rec.time,
          meet_name: rec.meetName || null,
          date: rec.meetDate || null,
          source,
          created_by: coachUid,
          // timeDisplay is derived on read; is_personal_best is trigger-owned
        }));

        const { data, error } = await supabase.from('swim_results').insert(rows).select('id');
        if (error) {
          // Intentionally swallowed: keep importing other swimmers and report
          // this swimmer's chunk error.
          logger.error('meetResultsImport:importMatchedResults:chunkInsertFail', {
            error: String(error.message ?? error),
            swimmerId,
          });
          result.errors.push(`Batch write failed for swimmer ${swimmerId}: ${error.message}`);
          continue;
        }

        result.imported += rows.length;
        for (const row of (data ?? []) as { id: string }[]) {
          insertedIds.push(row.id);
        }
      }

      // [RD-9] the PR count must reflect the trigger's truth, not a client
      // guess from stale reads — one recount query over the inserted ids.
      if (insertedIds.length > 0) {
        const { data: prRows, error: prError } = await supabase
          .from('swim_results')
          .select('id')
          .in('id', insertedIds)
          .eq('is_personal_best', true);
        if (prError) {
          logger.error('meetResultsImport:importMatchedResults:prRecountFail', {
            error: String(prError.message ?? prError),
            swimmerId,
          });
        } else {
          result.prs += (prRows ?? []).length;
        }
      }

      // If linked to a meet, update MeetEntry docs (Firestore until Phase H)
      if (meetId) {
        try {
          for (const match of swimmerMatches) {
            const rec = match.record;
            // Find the MeetEntry for this swimmer + event
            const entriesQ = query(
              collection(db, 'meets', meetId, 'entries'),
              where('swimmerId', '==', swimmerId),
              where('event', '==', rec.event),
            );
            const entriesSnap = await getDocs(entriesQ);
            for (const entryDoc of entriesSnap.docs) {
              await updateDoc(entryDoc.ref, {
                finalTime: rec.time,
                finalTimeDisplay: rec.timeDisplay,
                updatedAt: serverTimestamp(),
              });
            }
          }
        } catch (err: unknown) {
          // Intentionally swallowed: meet-entry sync failures should not discard imported times.
          logger.error('meetResultsImport:importMatchedResults:meetEntryUpdateFail', {
            error: String(err),
            meetId,
            swimmerId,
          });
          result.errors.push(
            `Meet entry update failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    await updateImportJob(importJobId, {
      status: 'complete',
      summary: {
        recordsProcessed: matches.length,
        swimmersCreated: 0,
        swimmersUpdated: 0,
        timesImported: result.imported,
        errors: result.errors,
      },
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Meet import failed';
    logger.error('meetResultsImport:importMatchedResults:fail', {
      error: String(error),
      recordsProcessed: matches.length,
      imported: result.imported,
    });
    await updateImportJob(importJobId, {
      status: 'failed',
      errorMessage,
      summary: {
        recordsProcessed: matches.length,
        swimmersCreated: 0,
        swimmersUpdated: 0,
        timesImported: result.imported,
        errors: [...result.errors, errorMessage],
      },
    });
    throw error;
  }
}
