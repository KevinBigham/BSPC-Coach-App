jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  arrayUnion: jest.fn((val: string) => ({ _arrayUnion: val })),
  arrayRemove: jest.fn((val: string) => ({ _arrayRemove: val })),
}));

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
  subscribeNotifications,
  markNotificationRead,
} from '../notifications';

const firestore = require('firebase/firestore');
const ExpoNotifications = require('expo-notifications');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('registerForPushNotifications', () => {
  it('returns push token when permissions are granted', async () => {
    const token = await registerForPushNotifications('coach-1');
    expect(token).toBe('ExponentPushToken[xxx]');
  });

  it('stores token in Firestore', async () => {
    await registerForPushNotifications('coach-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'coaches/coach-1' }),
      expect.objectContaining({ fcmTokens: expect.anything() }),
    );
  });

  it('returns null when permission denied', async () => {
    ExpoNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    ExpoNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const token = await registerForPushNotifications('coach-1');
    expect(token).toBeNull();
  });
});

describe('unregisterPushToken', () => {
  it('removes token from coach doc', async () => {
    await unregisterPushToken('coach-1', 'ExponentPushToken[xxx]');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'coaches/coach-1' }),
      expect.objectContaining({ fcmTokens: expect.anything() }),
    );
  });
});

describe('getNotificationPermissionStatus', () => {
  it('returns permission status string', async () => {
    const status = await getNotificationPermissionStatus();
    expect(status).toBe('granted');
  });
});

describe('subscribeNotifications', () => {
  it('queries notifications collection for the coach', () => {
    const cb = jest.fn();
    subscribeNotifications('coach-1', cb, 20);
    expect(firestore.collection).toHaveBeenCalledWith({}, 'notifications');
    expect(firestore.where).toHaveBeenCalledWith('coachId', '==', 'coach-1');
    expect(firestore.limit).toHaveBeenCalledWith(20);
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });
});

describe('markNotificationRead', () => {
  it('updates the notification doc with read: true', async () => {
    await markNotificationRead('notif-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notifications/notif-1' }),
      { read: true },
    );
  });
});
