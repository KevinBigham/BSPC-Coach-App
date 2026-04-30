/**
 * Shared meet results import logic used by both SDIF and HY3 parsers.
 * Handles swimmer matching, PR detection, and Firestore writes.
 * Optionally links results to an existing Meet (updating MeetEntry docs).
 */

import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Swimmer, SwimTime } from '../types/firestore.types';
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
 * Import matched results into swimmer time subcollections.
 * Optionally updates MeetEntry documents when meetId is provided.
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
            source,
            createdAt: serverTimestamp(),
            createdBy: coachUid,
          });

          result.imported++;
          if (isPR) result.prs++;

          // Un-PR old times if this is a new PR
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
          // Intentionally swallowed: keep importing other swimmers and report this swimmer's batch error.
          logger.error('meetResultsImport:importMatchedResults:batchCommitFail', {
            error: String(err),
            swimmerId,
          });
          result.errors.push(
            `Batch write failed for swimmer ${swimmerId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // If linked to a meet, update MeetEntry docs
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
