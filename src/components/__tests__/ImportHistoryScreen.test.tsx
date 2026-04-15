jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    coach: { uid: 'coach-1', displayName: 'Coach', role: 'admin' },
    isAdmin: true,
  })),
}));

const mockSubscribeImportJobs = jest.fn();

jest.mock('../../services/importJobs', () => ({
  subscribeImportJobs: (...args: unknown[]) => mockSubscribeImportJobs(...args),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import ImportHistoryScreen from '../../../app/import/history';

describe('ImportHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribeImportJobs.mockImplementation(
      (_coachId: string, callback: (items: Array<Record<string, unknown>>) => void) => {
        callback([
          {
            id: 'job-1',
            type: 'csv_roster',
            fileName: 'pasted-roster.csv',
            storagePath: 'manual/pasted-roster.csv',
            status: 'complete',
            summary: {
              recordsProcessed: 12,
              swimmersCreated: 10,
              swimmersUpdated: 0,
              timesImported: 0,
              errors: [],
            },
            coachId: 'coach-1',
            createdAt: new Date(),
          },
        ]);
        return jest.fn();
      },
    );
  });

  it('renders import job rows', () => {
    const { getByText } = render(<ImportHistoryScreen />);

    expect(getByText('pasted-roster.csv')).toBeTruthy();
    expect(getByText('CSV')).toBeTruthy();
    expect(getByText('COMPLETE')).toBeTruthy();
  });
});
