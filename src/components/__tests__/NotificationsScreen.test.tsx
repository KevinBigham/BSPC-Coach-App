jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    coach: { uid: 'coach-1', displayName: 'Coach', role: 'coach' },
  })),
}));

const mockSubscribeNotifications = jest.fn();
const mockMarkNotificationRead = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/notifications', () => ({
  subscribeNotifications: (...args: unknown[]) => mockSubscribeNotifications(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
}));

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import NotificationsScreen from '../../../app/notifications';

describe('NotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribeNotifications.mockImplementation(
      (_coachId: string, callback: (items: Array<Record<string, unknown>>) => void) => {
        callback([
          {
            id: 'notif-1',
            coachId: 'coach-1',
            title: 'Daily Practice Summary',
            body: '12 swimmers attended today.',
            type: 'daily_digest',
            data: { swimmerId: 'swimmer-1' },
            read: false,
            createdAt: new Date(),
          },
        ]);
        return jest.fn();
      },
    );
  });

  it('renders notifications and routes swimmer taps', async () => {
    const { getByText } = render(<NotificationsScreen />);

    expect(getByText('Daily Practice Summary')).toBeTruthy();
    expect(getByText('DAILY')).toBeTruthy();

    fireEvent.press(getByText('Daily Practice Summary'));

    await waitFor(() => {
      expect(mockMarkNotificationRead).toHaveBeenCalledWith('notif-1');
      expect(router.push).toHaveBeenCalledWith('/swimmer/swimmer-1');
    });
  });
});
