jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() =>
    jest.fn().mockResolvedValue({
      data: {
        title: 'AI Generated Practice',
        description: 'Endurance focus',
        sets: [
          {
            name: 'Warm-up',
            items: [{ reps: 4, distance: 100, stroke: 'Free', interval: '1:30' }],
          },
        ],
        totalYardage: 3000,
        estimatedDuration: 90,
      },
    }),
  ),
}));

import { generatePractice, type AIPracticeRequest } from '../aiPractice';

const functionsModule = require('firebase/functions');

beforeEach(() => {
  jest.clearAllMocks();
});

const validRequest: AIPracticeRequest = {
  group: 'Gold' as any,
  focus: 'endurance',
  targetYardage: 3000,
  durationMinutes: 90,
};

describe('generatePractice', () => {
  it('calls the Cloud Function with the request', async () => {
    await generatePractice(validRequest);
    expect(functionsModule.httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'generatePractice',
    );
  });

  it('returns the generated practice plan', async () => {
    const result = await generatePractice(validRequest);
    expect(result.title).toBe('AI Generated Practice');
    expect(result.totalYardage).toBe(3000);
    expect(result.estimatedDuration).toBe(90);
    expect(result.sets).toHaveLength(1);
    expect(result.sets[0].name).toBe('Warm-up');
  });

  it('passes optional meetName and notes', async () => {
    const requestWithMeet: AIPracticeRequest = {
      ...validRequest,
      meetName: 'State Championships',
      meetDate: '2026-04-15',
      notes: 'Focus on backstroke',
    };
    const fn = jest.fn().mockResolvedValue({
      data: {
        title: 'Race Prep',
        description: '',
        sets: [],
        totalYardage: 2000,
        estimatedDuration: 60,
      },
    });
    functionsModule.httpsCallable.mockReturnValueOnce(fn);

    await generatePractice(requestWithMeet);
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({
        meetName: 'State Championships',
        notes: 'Focus on backstroke',
      }),
    );
  });

  it('propagates errors from the Cloud Function', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Function failed'));
    functionsModule.httpsCallable.mockReturnValueOnce(fn);

    await expect(generatePractice(validRequest)).rejects.toThrow('Function failed');
  });

  it('handles all focus types without error', async () => {
    const focuses = ['endurance', 'speed', 'technique', 'recovery', 'race_prep', 'mixed'] as const;
    for (const focus of focuses) {
      const result = await generatePractice({ ...validRequest, focus });
      expect(result).toBeDefined();
    }
  });
});
