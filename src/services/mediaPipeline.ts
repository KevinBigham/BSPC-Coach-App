// Phase F (D-F2): client-invoke + scheduled sweeper replaces the Firestore
// document triggers. The data layer fires this after flipping a session to
// 'uploaded'; a failure here is NOT an upload failure — the sweeper picks the
// session up — so errors are logged and swallowed by design.
import { PROCESS_FUNCTIONS_BASE_URL, PROCESS_SHARED_SECRET } from '../config/functions';
import { logger } from '../utils/logger';

export async function requestSessionProcessing(
  kind: 'audio' | 'video',
  sessionId: string,
): Promise<void> {
  const endpoint = kind === 'audio' ? 'processAudioSession' : 'processVideoSession';
  try {
    await fetch(`${PROCESS_FUNCTIONS_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-process-secret': PROCESS_SHARED_SECRET,
      },
      body: JSON.stringify({ sessionId }),
    });
  } catch (err) {
    logger.warn('mediaPipeline:requestSessionProcessing:failed', {
      kind,
      sessionId,
      error: String(err),
    });
  }
}
