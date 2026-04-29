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

import { onNotesWritten } from '../triggers/onNotesWritten';

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
  };
}

function makeEvent(beforeData?: Record<string, unknown>, afterData?: Record<string, unknown>) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params: { swimmerId: 'swimmer-1', noteId: 'note-1' },
  } as any;
}

describe('onNotesWritten', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.collection.mockImplementation((path: string) => {
      if (path !== 'swimmers/swimmer-1/notes') {
        throw new Error(`Unexpected collection path: ${path}`);
      }
      return {
        get: jest
          .fn()
          .mockResolvedValue(
            createMockQuerySnapshot([
              createMockDoc('note-1', { createdAt: makeTimestamp('2026-04-08T12:00:00Z') }),
            ]),
          ),
      };
    });
  });

  it('dispatches note and dashboard activity recomputes when a note is created', async () => {
    const handler = handlerOf(onNotesWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent(undefined, { content: 'Great kick rhythm' }));

    expect(db.collection).toHaveBeenCalledWith('swimmers/swimmer-1/notes');
    expect(db.doc).toHaveBeenCalledWith('aggregations/swimmer_swimmer-1');
    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ noteCount: 1, lastNoteDate: expect.any(Object) }),
      { merge: true },
    );
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches recomputes when a note is updated', async () => {
    const handler = handlerOf(onNotesWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ content: 'Old note' }, { content: 'Updated note' }));

    expect(db.doc).toHaveBeenCalledWith('aggregations/swimmer_swimmer-1');
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches recomputes when a note is deleted', async () => {
    const handler = handlerOf(onNotesWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ content: 'Removed note' }, undefined));

    expect(db.doc).toHaveBeenCalledWith('aggregations/swimmer_swimmer-1');
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('does not gate dashboard activity on unchanged note fields', async () => {
    const handler = handlerOf(onNotesWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ content: 'Same note' }, { content: 'Same note' }));

    expect(db.doc).toHaveBeenCalledWith('aggregations/swimmer_swimmer-1');
    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });
});
