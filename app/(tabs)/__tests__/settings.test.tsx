// 05 §6.2(iv) + CALL-2: settings re-points onto the D-CUT7 pair. The three
// reader-less toggles (newNotes / attendanceAlerts / aiDraftsReady) are
// RETIRED at the swap as the round's one named UI change; Daily Digest is
// restored end-to-end onto notification_preferences.digest_enabled.
const mockGetNotificationPreferences = jest.fn();
const mockUpsertNotificationPreferences = jest.fn();

jest.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'coach-1' },
    coach: {
      uid: 'coach-1',
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
      fcmTokens: [],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    loading: false,
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    isAdmin: false,
  }),
}));

jest.mock('../../../src/services/notifications', () => ({
  getNotificationPermissionStatus: jest.fn().mockResolvedValue('granted'),
  getNotificationPreferences: (...args: unknown[]) => mockGetNotificationPreferences(...args),
  upsertNotificationPreferences: (...args: unknown[]) => mockUpsertNotificationPreferences(...args),
}));

import React from 'react';
import { Switch } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../settings';

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNotificationPreferences.mockResolvedValue({ pushEnabled: true, digestEnabled: true });
    mockUpsertNotificationPreferences.mockResolvedValue(undefined);
  });

  it('CALL-2: Daily Digest is the ONE live toggle, wired through the D-CUT7 pair; the three reader-less toggles are retired', async () => {
    const screen = render(<SettingsScreen />);

    expect(await screen.findByText('Daily Digest')).toBeTruthy();
    expect(screen.queryByText('New Notes')).toBeNull();
    expect(screen.queryByText('Attendance Alerts')).toBeNull();
    expect(screen.queryByText('AI Drafts Ready')).toBeNull();
    expect(screen.getByText('Push Notifications')).toBeTruthy();

    await waitFor(() => {
      expect(mockGetNotificationPreferences).toHaveBeenCalled();
    });

    const toggles = screen.UNSAFE_getAllByType(Switch);
    expect(toggles).toHaveLength(1);
    fireEvent(toggles[0], 'valueChange', false);

    await waitFor(() => {
      expect(mockUpsertNotificationPreferences).toHaveBeenCalledWith({ digestEnabled: false });
    });
  });
});
