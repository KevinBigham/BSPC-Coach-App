jest.mock('../../config/firebase', () => ({
  auth: {},
  db: {},
}));

const mockFirebaseSignOut = jest.fn().mockResolvedValue(undefined);
const mockGetDoc = jest.fn();

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth: unknown, callback: (user: unknown) => void) => {
    callback({ uid: 'coach-1', email: 'coach@test.com', displayName: 'Coach One' });
    return jest.fn();
  }),
  signInWithEmailAndPassword: jest.fn(),
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock]' }),
}));

const mockUnregisterPushToken = jest.fn().mockResolvedValue(undefined);
const mockUnsubscribeFromAllTopics = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/notifications', () => ({
  unregisterPushToken: (...args: unknown[]) => mockUnregisterPushToken(...args),
  unsubscribeFromAllTopics: (...args: unknown[]) => mockUnsubscribeFromAllTopics(...args),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function TestConsumer() {
  const { loading, signOut } = useAuth();

  if (loading) {
    return <Text>LOADING</Text>;
  }

  return (
    <TouchableOpacity onPress={() => void signOut()}>
      <Text>TRIGGER SIGN OUT</Text>
    </TouchableOpacity>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        email: 'coach@test.com',
        displayName: 'Coach One',
        role: 'coach',
        groups: ['Gold'],
        notificationPrefs: {
          dailyDigest: true,
          newNotes: true,
          attendanceAlerts: true,
          aiDraftsReady: true,
        },
        fcmTokens: ['ExponentPushToken[mock]'],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
  });

  it('cleans up push subscriptions before sign out', async () => {
    const { findByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.press(await findByText('TRIGGER SIGN OUT'));

    await waitFor(() => {
      expect(mockUnsubscribeFromAllTopics).toHaveBeenCalledWith('ExponentPushToken[mock]', [
        'Gold',
      ]);
      expect(mockUnregisterPushToken).toHaveBeenCalledWith('coach-1', 'ExponentPushToken[mock]');
      expect(mockFirebaseSignOut).toHaveBeenCalled();
    });
  });
});
