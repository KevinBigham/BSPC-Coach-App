import {
  createMockFirestore,
  createMockFieldValue,
  createMockDoc,
  createMockQuerySnapshot,
} from '../__mocks__/firebaseAdmin';

const { db, mockDocRef } = createMockFirestore();
const fieldValue = createMockFieldValue();

const mockRecomputeDashboardAttendanceAggregation = jest.fn().mockResolvedValue(undefined);
const mockRecomputeDashboardActivityAggregation = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    { FieldValue: fieldValue },
  ),
}));

jest.mock('../triggers/dashboardAggregations', () => ({
  recomputeDashboardAttendanceAggregation: mockRecomputeDashboardAttendanceAggregation,
  recomputeDashboardActivityAggregation: mockRecomputeDashboardActivityAggregation,
}));

import { onAttendanceWritten } from '../triggers/onAttendanceWritten';

function handlerOf(trigger: unknown) {
  return (
    (trigger as { __wrapped?: unknown; run?: unknown }).__wrapped ??
    (trigger as { run?: unknown }).run
  );
}

function makeSnapshot(data: Record<string, unknown> | undefined) {
  return { data: () => data };
}

function makeEvent(beforeData?: Record<string, unknown>, afterData?: Record<string, unknown>) {
  return {
    data: {
      before: makeSnapshot(beforeData),
      after: makeSnapshot(afterData),
    },
    params: { recordId: 'attendance-1' },
  } as any;
}

describe('onAttendanceWritten', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-08T12:00:00Z').getTime());
    db.collection.mockImplementation((path: string) => {
      if (path !== 'attendance') throw new Error(`Unexpected collection path: ${path}`);
      return {
        where: jest.fn().mockReturnValue({
          get: jest
            .fn()
            .mockResolvedValue(
              createMockQuerySnapshot([
                createMockDoc('a-1', { swimmerId: 'swimmer-1', practiceDate: '2026-04-08' }),
              ]),
            ),
        }),
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches per-swimmer and dashboard recomputes when attendance is created', async () => {
    const handler = handlerOf(onAttendanceWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent(undefined, { swimmerId: 'swimmer-1' }));

    expect(db.collection).toHaveBeenCalledWith('attendance');
    expect(db.doc).toHaveBeenCalledWith('aggregations/attendance_swimmer-1');
    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ totalPractices: 1, updatedAt: 'SERVER_TIMESTAMP' }),
      { merge: true },
    );
    expect(mockRecomputeDashboardAttendanceAggregation).toHaveBeenCalledTimes(1);
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches using the after swimmer id when attendance is updated', async () => {
    const handler = handlerOf(onAttendanceWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ swimmerId: 'swimmer-1' }, { swimmerId: 'swimmer-2' }));

    expect(db.doc).toHaveBeenCalledWith('aggregations/attendance_swimmer-2');
    expect(mockRecomputeDashboardAttendanceAggregation).toHaveBeenCalledTimes(1);
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches using the before swimmer id when attendance is deleted', async () => {
    const handler = handlerOf(onAttendanceWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ swimmerId: 'swimmer-1' }, undefined));

    expect(db.doc).toHaveBeenCalledWith('aggregations/attendance_swimmer-1');
    expect(mockRecomputeDashboardAttendanceAggregation).toHaveBeenCalledTimes(1);
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch when no swimmer id is present', async () => {
    const handler = handlerOf(onAttendanceWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({}, {}));

    expect(db.collection).not.toHaveBeenCalled();
    expect(mockRecomputeDashboardAttendanceAggregation).not.toHaveBeenCalled();
    expect(mockRecomputeDashboardActivityAggregation).not.toHaveBeenCalled();
  });
});
