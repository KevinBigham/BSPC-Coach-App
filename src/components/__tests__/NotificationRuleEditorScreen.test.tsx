jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    coach: { uid: 'coach-1', displayName: 'Coach', role: 'coach' },
  })),
}));

jest.mock('../../services/notificationRules', () => ({
  createNotificationRule: jest.fn().mockResolvedValue('rule-1'),
  updateNotificationRule: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import NotificationRuleEditorScreen from '../../../app/notification-rules/new';

describe('NotificationRuleEditorScreen', () => {
  it('renders the rule editor controls', () => {
    const { getByText, getByPlaceholderText } = render(<NotificationRuleEditorScreen />);

    expect(getByText('TRIGGER')).toBeTruthy();
    expect(getByText('MISSED PRACTICE')).toBeTruthy();
    expect(getByPlaceholderText('Optional coach-facing message')).toBeTruthy();
  });
});
