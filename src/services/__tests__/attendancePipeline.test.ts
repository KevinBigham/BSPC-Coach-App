// Phase G (D-G1): client-invoke + sweeper. The kick is fire-and-forget by
// design — the RATIFIED CONDITION is that it can never make an attendance
// write fail or wait; a failure is the sweeper's job, never the caller's.
jest.mock('../../config/functions', () => ({
  PROCESS_FUNCTIONS_BASE_URL: 'https://functions.test',
  PROCESS_SHARED_SECRET: 'test-secret',
}));

jest.mock('../../utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { requestAttendanceEvaluation } from '../attendancePipeline';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock;
});

describe('requestAttendanceEvaluation', () => {
  it('POSTs the attendance row ids to evaluateAttendanceRules with the shared secret', async () => {
    await requestAttendanceEvaluation(['att-1', 'att-2']);
    expect(global.fetch).toHaveBeenCalledWith('https://functions.test/evaluateAttendanceRules', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-process-secret': 'test-secret',
      },
      body: JSON.stringify({ attendanceIds: ['att-1', 'att-2'] }),
    });
  });

  it('does not call out at all for an empty id list', async () => {
    await requestAttendanceEvaluation([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('swallows endpoint failures — the sweeper owns retries (never rejects)', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('down'));
    await expect(requestAttendanceEvaluation(['att-1'])).resolves.toBeUndefined();
  });
});
