jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    coach: { uid: 'coach-1', displayName: 'Coach', role: 'coach' },
  })),
}));

const mockSubscribeNotificationRules = jest.fn();

jest.mock('../../services/notificationRules', () => ({
  subscribeNotificationRules: (...args: unknown[]) => mockSubscribeNotificationRules(...args),
  updateNotificationRule: jest.fn().mockResolvedValue(undefined),
  deleteNotificationRule: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import NotificationRulesScreen from '../../../app/notification-rules';

describe('NotificationRulesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribeNotificationRules.mockImplementation(
      (_coachId: string, callback: (items: Array<Record<string, unknown>>) => void) => {
        callback([]);
        return jest.fn();
      },
    );
  });

  it('renders the empty state', () => {
    const { getByText } = render(<NotificationRulesScreen />);

    expect(getByText('ATTENDANCE ALERTS')).toBeTruthy();
    expect(getByText('--- NO RULES ---')).toBeTruthy();
  });
});
