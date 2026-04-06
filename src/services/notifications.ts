import * as Notifications from 'expo-notifications';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { Platform } from 'react-native';
import type { Notification } from '../types/firestore.types';
import type { Group } from '../config/constants';
import { logger } from '../utils/logger';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(coachUid: string): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'BSPC Coach',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Store token in coach's Firestore doc
  await updateDoc(doc(db, 'coaches', coachUid), {
    fcmTokens: arrayUnion(token),
  });

  return token;
}

export async function unregisterPushToken(coachUid: string, token: string): Promise<void> {
  await updateDoc(doc(db, 'coaches', coachUid), {
    fcmTokens: arrayRemove(token),
  });
}

export async function getNotificationPermissionStatus(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export function subscribeNotifications(
  coachId: string,
  callback: (notifications: (Notification & { id: string })[]) => void,
  max = 30,
) {
  const q = query(
    collection(db, 'notifications'),
    where('coachId', '==', coachId),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification & { id: string }),
    );
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

/**
 * Subscribe a push token to FCM topics for the coach's groups + broadcast.
 * Called after successful push token registration.
 */
export async function subscribeToGroupTopics(token: string, groups: Group[]): Promise<void> {
  const callable = httpsCallable(functions, 'manageTopicSubscription');
  const topics = [...groups.map((g) => `group_${g}`), 'broadcast_all'];

  for (const topic of topics) {
    try {
      await callable({ action: 'subscribe', topic, token });
    } catch (err) {
      logger.warn(`Failed to subscribe to topic ${topic}`, err as Record<string, unknown>);
    }
  }
}

/**
 * Unsubscribe a push token from all group topics + broadcast.
 * Called when a coach signs out or token is invalidated.
 */
export async function unsubscribeFromAllTopics(token: string, groups: Group[]): Promise<void> {
  const callable = httpsCallable(functions, 'manageTopicSubscription');
  const topics = [...groups.map((g) => `group_${g}`), 'broadcast_all'];

  for (const topic of topics) {
    try {
      await callable({ action: 'unsubscribe', topic, token });
    } catch (err) {
      logger.warn(`Failed to unsubscribe from topic ${topic}`, err as Record<string, unknown>);
    }
  }
}
