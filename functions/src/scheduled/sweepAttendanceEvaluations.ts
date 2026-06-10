// Phase G (D-G1): the at-least-once half of client-invoke + sweeper. Any
// attendance row whose kick was lost is re-evaluated here. Unlike the media
// sweep there is no status marker to gate on — the upsert's deterministic-id
// merge semantics make re-evaluation invisible, so the sweep simply re-runs
// the recent window (created_at-based: attendance has no updated_at column,
// so a checkout AFTER the window whose kick was lost is not re-swept — the
// rule inputs a checkout can change are nil; see UNIFY/11).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { supabase } from '../config/supabase';
import { evaluateAttendanceRowIds } from '../notifications/evaluator';

const SWEEP_WINDOW_MS = 10 * 60 * 1000;

export async function sweepAttendanceEvaluationsOnce(): Promise<number> {
  const cutoff = new Date(Date.now() - SWEEP_WINDOW_MS).toISOString();

  const { data } = await supabase.from('attendance').select('id').gte('created_at', cutoff);
  const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);

  if (ids.length > 0) {
    await evaluateAttendanceRowIds(ids);
  }
  return ids.length;
}

export const sweepAttendanceEvaluations = onSchedule('every 5 minutes', async () => {
  await sweepAttendanceEvaluationsOnce();
});
