// Phase G (D-G1): the at-least-once half. The sweep re-evaluates the recent
// created_at window; the upsert's merge semantics make overlap with the
// client kick invisible.
interface AttendanceBuilder {
  select: jest.Mock;
  gte: jest.Mock;
}

const attendanceBuilder: AttendanceBuilder = {
  select: jest.fn().mockReturnThis(),
  gte: jest.fn(),
};

jest.mock('../config/supabase', () => ({
  supabase: { from: () => attendanceBuilder },
}));

const mockEvaluate = jest.fn().mockResolvedValue(undefined);
jest.mock('../notifications/evaluator', () => ({
  evaluateAttendanceRowIds: (ids: string[]) => mockEvaluate(ids),
}));

import {
  sweepAttendanceEvaluations,
  sweepAttendanceEvaluationsOnce,
} from '../scheduled/sweepAttendanceEvaluations';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sweepAttendanceEvaluations', () => {
  it('is defined', () => {
    expect(sweepAttendanceEvaluations).toBeDefined();
  });

  it('re-evaluates every attendance row created inside the window', async () => {
    attendanceBuilder.gte.mockResolvedValue({
      data: [{ id: 'att-1' }, { id: 'att-2' }],
      error: null,
    });

    const count = await sweepAttendanceEvaluationsOnce();

    expect(attendanceBuilder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(mockEvaluate).toHaveBeenCalledWith(['att-1', 'att-2']);
    expect(count).toBe(2);
  });

  it('no-ops cleanly on an empty window', async () => {
    attendanceBuilder.gte.mockResolvedValue({ data: [], error: null });

    const count = await sweepAttendanceEvaluationsOnce();

    expect(mockEvaluate).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });
});
