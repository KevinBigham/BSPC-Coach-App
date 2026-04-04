import { withRetry } from '../errorHandler';

// Silence console.error from handleError
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { delays: [10, 20] });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('recovered');
    const result = await withRetry(fn, { delays: [10, 10, 10] });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after all retries exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('permanent'));
    await expect(withRetry(fn, { delays: [10, 10] })).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('calls handleError with context when retries exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(withRetry(fn, { delays: [10], context: 'TestOp' })).rejects.toThrow('boom');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[TestOp]'));
  });

  it('uses default delays when not specified', async () => {
    const fn = jest.fn().mockResolvedValue('fast');
    const result = await withRetry(fn);
    expect(result).toBe('fast');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits between retries', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
    const start = Date.now();
    await withRetry(fn, { delays: [50] });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow slight timing variance
  });
});
