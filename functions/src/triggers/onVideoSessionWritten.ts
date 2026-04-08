import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { recomputeDashboardActivityAggregation } from './dashboardAggregations';

/**
 * Recompute dashboard activity whenever a video session changes.
 */
export const onVideoSessionWritten = onDocumentWritten('video_sessions/{sessionId}', async () => {
  await recomputeDashboardActivityAggregation();
});
