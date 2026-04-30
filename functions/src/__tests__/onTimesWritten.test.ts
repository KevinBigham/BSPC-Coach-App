import {
  createMockFirestore,
  createMockFieldValue,
  createMockDoc,
  createMockQuerySnapshot,
} from '../__mocks__/firebaseAdmin';

const { db, mockDocRef } = createMockFirestore();
const fieldValue = createMockFieldValue();

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
  recomputeDashboardActivityAggregation: mockRecomputeDashboardActivityAggregation,
}));

import { onTimesWritten } from '../triggers/onTimesWritten';

function handlerOf(trigger: unknown) {
  return (
    (trigger as { __wrapped?: unknown; run?: unknown }).__wrapped ??
    (trigger as { run?: unknown }).run
  );
}

function makeTimestamp(iso: string) {
  const date = new Date(iso);
  return {
    toMillis: () => date.getTime(),
    toDate: () => date,
  };
}

function makeEvent(beforeData?: Record<string, unknown>, afterData?: Record<string, unknown>) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params: { swimmerId: 'swimmer-1', timeId: 'time-1' },
  } as any;
}

describe('onTimesWritten', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.collection.mockImplementation((path: string) => {
      if (path !== 'swimmers/swimmer-1/times') {
        throw new Error(`Unexpected collection path: ${path}`);
      }
      return {
        get: jest.fn().mockResolvedValue(
          createMockQuerySnapshot([
            createMockDoc('time-1', {
              event: '50 Free',
              course: 'SCY',
              time: 2450,
              timeDisplay: '24.50',
              meetDate: makeTimestamp('2026-04-08T12:00:00Z'),
            }),
          ]),
        ),
      };
    });
  });

  it('dispatches swimmer PR and activity recomputes when a PR time is created', async () => {
    const handler = handlerOf(onTimesWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent(undefined, { isPR: true }));

    expect(db.collection).toHaveBeenCalledWith('swimmers/swimmer-1/times');
    expect(db.doc).toHaveBeenCalledWith('aggregations/swimmer_swimmer-1');
    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        prsByEvent: expect.objectContaining({
          '50 Free_SCY': expect.objectContaining({ time: 2450, timeDisplay: '24.50' }),
        }),
      }),
      { merge: true },
    );
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches swimmer PR and activity recomputes for a non-PR time as well', async () => {
    const handler = handlerOf(onTimesWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent(undefined, { isPR: false }));

    expect(db.doc).toHaveBeenCalledWith('aggregations/swimmer_swimmer-1');
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches swimmer PR and activity recomputes when a row is updated', async () => {
    const handler = handlerOf(onTimesWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ isPR: false }, { isPR: true }));

    expect(db.doc).toHaveBeenCalledWith('aggregations/swimmer_swimmer-1');
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches swimmer PR and activity recomputes when a row is deleted', async () => {
    const handler = handlerOf(onTimesWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ isPR: true }, undefined));

    expect(db.doc).toHaveBeenCalledWith('aggregations/swimmer_swimmer-1');
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });
});
