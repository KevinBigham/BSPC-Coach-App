// Phase F (D-F2): client-invoke + sweeper. The kick is fire-and-forget by
// design — a failure is the sweeper's job, never the caller's.
jest.mock('../../config/functions', () => ({
  PROCESS_FUNCTIONS_BASE_URL: 'https://functions.test',
  PROCESS_SHARED_SECRET: 'test-secret',
}));

import { requestSessionProcessing } from '../mediaPipeline';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock;
});

describe('requestSessionProcessing', () => {
  it('POSTs the audio session id to processAudioSession with the shared secret', async () => {
    await requestSessionProcessing('audio', 'a-1');
    expect(global.fetch).toHaveBeenCalledWith('https://functions.test/processAudioSession', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-process-secret': 'test-secret',
      },
      body: JSON.stringify({ sessionId: 'a-1' }),
    });
  });

  it('routes video sessions to processVideoSession', async () => {
    await requestSessionProcessing('video', 'v-1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://functions.test/processVideoSession',
      expect.anything(),
    );
  });

  it('swallows endpoint failures — the sweeper owns retries', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('down'));
    await expect(requestSessionProcessing('audio', 'a-1')).resolves.toBeUndefined();
  });
});
