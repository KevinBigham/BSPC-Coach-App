import * as Notifications from 'expo-notifications';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Platform } from 'react-native';
import type { Notification } from '../types/firestore.types';

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
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Notification & { id: string })),
    );
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}
