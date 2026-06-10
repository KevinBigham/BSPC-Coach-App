import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import type { Notification } from '../types/firestore.types';

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface InAppNotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: Notification['type'] | null;
  data: Record<string, string> | null;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATION_SELECT = 'id, user_id, title, body, category, data, is_read, created_at';

function rowToNotification(row: InAppNotificationRow): Notification & { id: string } {
  return {
    id: row.id,
    coachId: row.user_id,
    title: row.title,
    body: row.body,
    type: row.category ?? 'general',
    data: row.data ?? undefined,
    read: row.is_read,
    createdAt: new Date(row.created_at),
  } as Notification & { id: string };
}

/**
 * Register this device for push and store the Expo token in its canonical
 * home, push_tokens (D-G2: storage parity — registration has no caller yet;
 * coach push delivery is a named post-cutover product line item).
 */
export async function registerForPushNotifications(coachUid: string): Promise<string | null> {
  void coachUid; // own-row table is keyed by the auth user; param kept for signature compat

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

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      is_active: true,
      // push_tokens has no update trigger; the canonical-native client stamps it
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' },
  );
  if (error) throw error;

  return token;
}

export async function unregisterPushToken(coachUid: string, token: string): Promise<void> {
  void coachUid; // own-row table is keyed by the auth user; param kept for signature compat
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('expo_push_token', token);
  if (error) throw error;
}

export async function getNotificationPermissionStatus(): Promise<string> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

let channelSeq = 0;

/**
 * Live list of the signed-in user's notifications. Scoping is the RLS
 * own-row wall itself: the select returns only the caller's rows and
 * realtime delivers only rows the subscriber can read — no client-side
 * user filter exists to get wrong.
 */
export function subscribeNotifications(
  coachId: string,
  callback: (notifications: (Notification & { id: string })[]) => void,
  max = 30,
): Unsubscribe {
  let active = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('in_app_notifications')
      .select(NOTIFICATION_SELECT)
      .order('created_at', { ascending: false })
      .limit(max);
    if (!active || error || !data) return;
    callback((data as unknown as InAppNotificationRow[]).map(rowToNotification));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`in_app_notifications:${coachId}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'in_app_notifications' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export function getUnreadCount(coachId: string, callback: (count: number) => void): Unsubscribe {
  let active = true;

  const emit = async (): Promise<void> => {
    const { count, error } = await supabase
      .from('in_app_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    if (!active || error) return;
    callback(count ?? 0);
  };

  void emit();

  const channel = supabase
    .channel(`in_app_notifications:unread:${coachId}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'in_app_notifications' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('in_app_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}
