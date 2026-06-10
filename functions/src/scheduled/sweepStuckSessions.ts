// Phase F (D-F2): the at-least-once half of client-invoke + sweeper. Any
// session that flipped to 'uploaded' but never got (or never finished) its
// kick is re-processed here. The pipeline cores gate on status='uploaded',
// so a session a client kick is ALREADY processing has moved off 'uploaded'
// and the sweep skips it.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { supabase } from '../config/supabase';
import { processAudioSessionById, processVideoSessionById } from '../media/pipeline';

const STUCK_AFTER_MS = 5 * 60 * 1000;

export async function sweepStuckSessionsOnce(): Promise<{ audio: number; video: number }> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const counts = { audio: 0, video: 0 };

  const { data: audioRows } = await supabase
    .from('audio_sessions')
    .select('id')
    .eq('status', 'uploaded')
    .lt('updated_at', cutoff);
  for (const row of (audioRows ?? []) as { id: string }[]) {
    // error isolation: one bad session must not starve the rest of the sweep
    await processAudioSessionById(row.id).catch((err) =>
      console.error('sweep audio failed:', row.id, err),
    );
    counts.audio += 1;
  }

  const { data: videoRows } = await supabase
    .from('video_sessions')
    .select('id')
    .eq('status', 'uploaded')
    .lt('updated_at', cutoff);
  for (const row of (videoRows ?? []) as { id: string }[]) {
    await processVideoSessionById(row.id).catch((err) =>
      console.error('sweep video failed:', row.id, err),
    );
    counts.video += 1;
  }

  return counts;
}

export const sweepStuckSessions = onSchedule(
  { schedule: 'every 5 minutes', timeoutSeconds: 540, memory: '1GiB' },
  async () => {
    await sweepStuckSessionsOnce();
  },
);
