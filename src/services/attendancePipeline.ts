// Phase G (D-G1): client-invoke + scheduled sweeper replaces the Firestore
// attendance trigger. The data layer fires this after a check-in/checkout
// commits. RATIFIED CONDITION: the kick must never make an attendance write
// fail or wait — a failure here is NOT an attendance failure (the sweeper
// covers it), so errors are logged and swallowed by design, and this function
// NEVER rejects.
import { PROCESS_FUNCTIONS_BASE_URL, PROCESS_SHARED_SECRET } from '../config/functions';
import { logger } from '../utils/logger';

export async function requestAttendanceEvaluation(attendanceIds: string[]): Promise<void> {
  if (attendanceIds.length === 0) return;
  try {
    await fetch(`${PROCESS_FUNCTIONS_BASE_URL}/evaluateAttendanceRules`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-process-secret': PROCESS_SHARED_SECRET,
      },
      body: JSON.stringify({ attendanceIds }),
    });
  } catch (err) {
    logger.warn('attendancePipeline:requestAttendanceEvaluation:failed', {
      attendanceIds,
      error: String(err),
    });
  }
}
