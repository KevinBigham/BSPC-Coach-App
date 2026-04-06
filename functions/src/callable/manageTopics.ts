import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const messaging = admin.messaging();

/** Valid topic prefixes */
const VALID_GROUPS = ['Bronze', 'Silver', 'Gold', 'Advanced', 'Platinum', 'Diamond'];
const VALID_TOPICS = [...VALID_GROUPS.map((g) => `group_${g}`), 'broadcast_all'];

interface TopicRequest {
  action: 'subscribe' | 'unsubscribe';
  topic: string;
  token: string;
}

/**
 * Subscribe or unsubscribe a push token to/from an FCM topic.
 * Topics allow group-targeted and broadcast notifications without iterating tokens.
 */
export const manageTopicSubscription = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { action, topic, token } = request.data as TopicRequest;

  if (!action || !topic || !token) {
    throw new HttpsError('invalid-argument', 'Missing required fields: action, topic, token');
  }

  if (action !== 'subscribe' && action !== 'unsubscribe') {
    throw new HttpsError('invalid-argument', 'Action must be "subscribe" or "unsubscribe"');
  }

  if (!VALID_TOPICS.includes(topic)) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid topic "${topic}". Must be one of: ${VALID_TOPICS.join(', ')}`,
    );
  }

  try {
    if (action === 'subscribe') {
      await messaging.subscribeToTopic([token], topic);
    } else {
      await messaging.unsubscribeFromTopic([token], topic);
    }
    return { success: true, action, topic };
  } catch (err: any) {
    throw new HttpsError('internal', `Failed to ${action} topic: ${err.message}`);
  }
});
