// Data layer migrated Firestore -> Supabase (Phase G). The notification list
// and unread badge read in_app_notifications; scoping is the RLS own-row wall
// (no client-side user filter exists to get wrong). Push-token storage moved
// to its canonical home, push_tokens (D-G2: storage parity only — coach push
// delivery is a named post-cutover product line item).
//
// DELETED with their subject (manageTopics / FCM topic machinery, retired in
// Phase G — Expo push has no topics; group fan-out is sender-side):
//   - "subscribes to group topics + broadcast_all"
//   - "continues on individual topic failure"
//   - "unsubscribes from group topics + broadcast_all"
// Replacement proofs: pgTAP 011 walls (delivery scope lives in the database),
// push_tokens storage pins below.
jest.mock('../../config/supabase', () => {
  const state: {
    selectRows: unknown[];
    count: number;
    user: { id: string } | null;
    onHandler: ((p: unknown) => void) | null;
  } = {
    selectRows: [],
    count: 0,
    user: { id: 'auth-user-1' },
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    order: jest.fn(() => query),
    eq: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    upsert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, count: state.count, error: null }).then(
        resolve,
        reject,
      ),
  };
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.onHandler = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn(() => query),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: state.user }, error: null })),
    },
  };
  return { supabase, __state: state, __query: query, __channel: channel };
});

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[xxx]' }),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import {
  registerForPushNotifications,
  unregisterPushToken,
  getNotificationPermissionStatus,
  getUnreadCount,
  subscribeNotifications,
  markNotificationRead,
} from '../notifications';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;
const ExpoNotifications = require('expo-notifications');

const flush = () => new Promise((resolve) => setImmediate(resolve));

const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'n-1',
  user_id: 'auth-user-1',
  title: 'Streak Alert',
  body: 'Swimmer One hit a 5-practice streak.',
  category: 'general',
  data: { trigger: 'attendance_streak' },
  is_read: false,
  created_at: '2026-06-10T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.count = 0;
  __state.user = { id: 'auth-user-1' };
  __state.onHandler = null;
});

describe('registerForPushNotifications', () => {
  it('returns push token when permissions are granted', async () => {
    const token = await registerForPushNotifications('coach-1');
    expect(token).toBe('ExponentPushToken[xxx]');
  });

  it('stores the token in push_tokens, its canonical home (upsert by user+token)', async () => {
    await registerForPushNotifications('coach-1');
    expect(supabase.from).toHaveBeenCalledWith('push_tokens');
    expect(__query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'auth-user-1',
        expo_push_token: 'ExponentPushToken[xxx]',
        platform: 'ios',
        is_active: true,
      }),
      { onConflict: 'user_id,expo_push_token' },
    );
  });

  it('returns null when permission denied', async () => {
    ExpoNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    ExpoNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const token = await registerForPushNotifications('coach-1');
    expect(token).toBeNull();
  });

  it('returns null without storing when there is no session', async () => {
    __state.user = null;
    const token = await registerForPushNotifications('coach-1');
    expect(token).toBeNull();
    expect(__query.upsert).not.toHaveBeenCalled();
  });
});

describe('unregisterPushToken', () => {
  it('deletes exactly the supplied token row for the signed-in user', async () => {
    await unregisterPushToken('coach-1', 'ExponentPushToken[xxx]');
    expect(supabase.from).toHaveBeenCalledWith('push_tokens');
    expect(__query.delete).toHaveBeenCalled();
    expect(__query.eq).toHaveBeenCalledWith('user_id', 'auth-user-1');
    expect(__query.eq).toHaveBeenCalledWith('expo_push_token', 'ExponentPushToken[xxx]');
  });
});

describe('getNotificationPermissionStatus', () => {
  it('returns permission status string', async () => {
    const status = await getNotificationPermissionStatus();
    expect(status).toBe('granted');
  });
});

describe('subscribeNotifications', () => {
  it('reads the newest N rows with NO user filter — the RLS own-row wall IS the scope', () => {
    subscribeNotifications('coach-1', jest.fn(), 20);
    expect(supabase.from).toHaveBeenCalledWith('in_app_notifications');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(20);
    expect(__query.eq).not.toHaveBeenCalled();
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'in_app_notifications' }),
      expect.any(Function),
    );
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('maps rows to the frozen Notification shape (user_id->coachId, category->type, is_read->read)', async () => {
    __state.selectRows = [makeRow(), makeRow({ id: 'n-2', category: null, data: null })];
    const cb = jest.fn();
    subscribeNotifications('coach-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledWith([
      {
        id: 'n-1',
        coachId: 'auth-user-1',
        title: 'Streak Alert',
        body: 'Swimmer One hit a 5-practice streak.',
        type: 'general',
        data: { trigger: 'attendance_streak' },
        read: false,
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
      },
      expect.objectContaining({ id: 'n-2', type: 'general', data: undefined }),
    ]);
  });

  it('re-emits the full list when a realtime change fires', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeNotifications('coach-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('returns a synchronous unsubscribe that removes the channel', () => {
    const unsub = subscribeNotifications('coach-1', jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });
});

describe('getUnreadCount', () => {
  it('counts unread rows (RLS-scoped) and reports the count', async () => {
    __state.count = 3;
    const callback = jest.fn();
    getUnreadCount('coach-1', callback);
    await flush();
    expect(supabase.from).toHaveBeenCalledWith('in_app_notifications');
    expect(__query.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(__query.eq).toHaveBeenCalledWith('is_read', false);
    expect(callback).toHaveBeenCalledWith(3);
  });

  it('re-counts when a realtime change fires', async () => {
    const callback = jest.fn();
    getUnreadCount('coach-1', callback);
    await flush();
    expect(callback).toHaveBeenCalledTimes(1);
    __state.count = 1;
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(callback).toHaveBeenLastCalledWith(1);
  });
});

describe('markNotificationRead', () => {
  it('updates is_read by id (the one own-row write)', async () => {
    await markNotificationRead('notif-1');
    expect(supabase.from).toHaveBeenCalledWith('in_app_notifications');
    expect(__query.update).toHaveBeenCalledWith({ is_read: true });
    expect(__query.eq).toHaveBeenCalledWith('id', 'notif-1');
  });
});
