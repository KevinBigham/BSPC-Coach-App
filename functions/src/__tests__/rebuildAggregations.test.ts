import { createMockFirestore, createMockFieldValue } from '../__mocks__/firebaseAdmin';

const { db } = createMockFirestore();
const fieldValue = createMockFieldValue();

const recomputeAttendanceAggregation = jest.fn().mockResolvedValue(undefined);
const recomputeSwimmerPRs = jest.fn().mockResolvedValue(undefined);
const recomputeNotesAggregation = jest.fn().mockResolvedValue(undefined);
const recomputeDashboardAttendanceAggregation = jest.fn().mockResolvedValue(undefined);
const recomputeDashboardActivityAggregation = jest.fn().mockResolvedValue(undefined);

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

// Roster enumeration reads canonical swimmers (UNIFY Phase B)
jest.mock('../config/supabase', () => {
  const state: { rows: unknown[] } = { rows: [] };
  interface QueryMock {
    select: jest.Mock;
    eq: jest.Mock;
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
  }
  const query: QueryMock = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.rows, error: null }).then(resolve, reject),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __state: state, __query: query };
});

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
}));

import { rebuildAggregations } from '../scheduled/rebuildAggregations';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../config/supabase');
const { __state, __query } = supabaseMock;
const mockSupabase = supabaseMock.supabase;

describe('rebuildAggregations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __state.rows = [{ id: 'swimmer-1' }, { id: 'swimmer-2' }];
  });

  it('recomputes dashboard docs once after per-swimmer rebuilds', async () => {
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

    expect(mockSupabase.from).toHaveBeenCalledWith('swimmers');
    expect(__query.eq).toHaveBeenCalledWith('is_active', true);
    expect(recomputeAttendanceAggregation).toHaveBeenCalledTimes(2);
    expect(recomputeSwimmerPRs).toHaveBeenCalledTimes(2);
    expect(recomputeNotesAggregation).toHaveBeenCalledTimes(2);
    expect(recomputeDashboardAttendanceAggregation).toHaveBeenCalledTimes(1);
    expect(recomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });
});
