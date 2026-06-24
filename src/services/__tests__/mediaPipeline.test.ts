// Proposal C (Director Ruling 28/29): media AI processing is disabled in v1.
// requestSessionProcessing is retained as an unconditional no-op — for either
// kind it must perform no network fetch, read no Functions config, and emit no
// processing-error log.

import { requestSessionProcessing } from '../mediaPipeline';
import { logger } from '../../utils/logger';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock;
});

describe('requestSessionProcessing', () => {
  it('performs no fetch and resolves for an audio request', async () => {
    await expect(requestSessionProcessing('audio', 'a-1')).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('performs no fetch and resolves for a video request', async () => {
    await expect(requestSessionProcessing('video', 'v-1')).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('performs no fetch and emits no processing-error log across repeated audio/video calls', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    (global.fetch as jest.Mock).mockRejectedValue(new Error('endpoint should never be contacted'));

    await expect(requestSessionProcessing('audio', 'a-1')).resolves.toBeUndefined();
    await expect(requestSessionProcessing('video', 'v-1')).resolves.toBeUndefined();
    await expect(requestSessionProcessing('audio', 'a-2')).resolves.toBeUndefined();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
