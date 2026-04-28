import {
  createMockFirestore,
  createMockFieldValue,
  createMockDoc,
  createMockQuerySnapshot,
} from '../__mocks__/firebaseAdmin';

const { db } = createMockFirestore();
const fieldValue = createMockFieldValue();

const recomputeAttendanceAggregation = jest.fn().mockResolvedValue(undefined);
const recomputeSwimmerPRs = jest.fn().mockResolvedValue(undefined);
const recomputeNotesAggregation = jest.fn().mockResolvedValue(undefined);
const recomputeDashboardAttendanceAggregation = jest.fn().mockResolvedValue(undefined);
const recomputeDashboardActivityAggregation = jest.fn().mockResolvedValue(undefined);
const recomputeDashboardRecentPRsAggregation = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    {
      FieldValue: fieldValue,
    },
  ),
}));

jest.mock('../triggers/onAttendanceWritten', () => ({
  recomputeAttendanceAggregation,
}));

jest.mock('../triggers/onTimesWritten', () => ({
  recomputeSwimmerPRs,
}));

jest.mock('../triggers/onNotesWritten', () => ({
  recomputeNotesAggregation,
}));

jest.mock('../triggers/dashboardAggregations', () => ({
  recomputeDashboardAttendanceAggregation,
  recomputeDashboardActivityAggregation,
  recomputeDashboardRecentPRsAggregation,
}));

import { rebuildAggregations } from '../scheduled/rebuildAggregations';

describe('rebuildAggregations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recomputes dashboard docs once after per-swimmer rebuilds', async () => {
    db.collection.mockImplementation((path: string) => {
      if (path === 'swimmers') {
        return {
          where: jest.fn().mockReturnValue({
            get: jest
              .fn()
              .mockResolvedValue(
                createMockQuerySnapshot([
                  createMockDoc('swimmer-1', { active: true }),
                  createMockDoc('swimmer-2', { active: true }),
                ]),
              ),
          }),
        };
      }

      throw new Error(`Unexpected collection path: ${path}`);
    });

    const handler =
      (
        rebuildAggregations as unknown as {
          __wrapped?: (event: unknown) => Promise<void>;
          run?: (event: unknown) => Promise<void>;
        }
      ).__wrapped ??
      (rebuildAggregations as unknown as { run?: (event: unknown) => Promise<void> }).run;

    if (!handler) {
      throw new Error('Missing scheduler handler');
    }

    await handler({});

    expect(recomputeAttendanceAggregation).toHaveBeenCalledTimes(2);
    expect(recomputeSwimmerPRs).toHaveBeenCalledTimes(2);
    expect(recomputeNotesAggregation).toHaveBeenCalledTimes(2);
    expect(recomputeDashboardAttendanceAggregation).toHaveBeenCalledTimes(1);
    expect(recomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
    expect(recomputeDashboardRecentPRsAggregation).toHaveBeenCalledTimes(1);
  });
});
