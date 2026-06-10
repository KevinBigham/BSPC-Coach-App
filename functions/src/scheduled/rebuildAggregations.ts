import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { supabase } from '../config/supabase';
import { recomputeAttendanceAggregation } from '../triggers/onAttendanceWritten';
import { recomputeSwimmerPRs } from '../triggers/onTimesWritten';
import { recomputeNotesAggregation } from '../triggers/onNotesWritten';
import {
  recomputeDashboardAttendanceAggregation,
  recomputeDashboardActivityAggregation,
} from '../triggers/dashboardAggregations';

if (!admin.apps.length) admin.initializeApp();

/** Max recomputes in flight at once */
const BATCH_CHUNK = 400;

/**
 * Daily safety-net rebuild of all aggregations.
 * Runs at 4 AM to ensure consistency even if triggers missed events.
 * Roster enumeration reads canonical swimmers (UNIFY/04 Phase B); the
 * recompute internals stay on Firestore until their own phases (C/D/E/J).
 */
export const rebuildAggregations = onSchedule('every day 04:00', async () => {
  const { data, error } = await supabase.from('swimmers').select('id').eq('is_active', true);
  if (error) throw error;

  const swimmerIds = ((data ?? []) as { id: string }[]).map((row) => row.id);

  // Process in chunks to avoid overwhelming Firestore
  for (let i = 0; i < swimmerIds.length; i += BATCH_CHUNK) {
    const chunk = swimmerIds.slice(i, i + BATCH_CHUNK);
    await Promise.all(
      chunk.map(async (id) => {
        await recomputeAttendanceAggregation(id);
        await recomputeSwimmerPRs(id);
        await recomputeNotesAggregation(id);
      }),
    );
  }

  await recomputeDashboardAttendanceAggregation();
  await recomputeDashboardActivityAggregation();
});
