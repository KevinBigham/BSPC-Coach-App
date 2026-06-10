// Phase F (D-F2): the sweeper is the at-least-once guarantee behind the
// client kick — anything stuck in 'uploaded' gets re-processed.
const mockProcessAudio = jest.fn().mockResolvedValue(undefined);
const mockProcessVideo = jest.fn().mockResolvedValue(undefined);
jest.mock('../media/pipeline', () => ({
  processAudioSessionById: (id: string) => mockProcessAudio(id),
  processVideoSessionById: (id: string) => mockProcessVideo(id),
}));

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
}));

interface StuckBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  lt: jest.Mock;
}
const audioBuilder: StuckBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  lt: jest.fn(),
};
const videoBuilder: StuckBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  lt: jest.fn(),
};
const mockSupabaseFrom = jest.fn((table: string) =>
  table === 'audio_sessions' ? audioBuilder : videoBuilder,
);

jest.mock('../config/supabase', () => ({
  supabase: { from: (table: string) => mockSupabaseFrom(table) },
}));

import { sweepStuckSessionsOnce } from '../scheduled/sweepStuckSessions';

beforeEach(() => {
  jest.clearAllMocks();
  audioBuilder.lt.mockResolvedValue({ data: [], error: null });
  videoBuilder.lt.mockResolvedValue({ data: [], error: null });
});

describe('sweepStuckSessionsOnce', () => {
  it("selects sessions stuck in 'uploaded' older than the cutoff and re-processes each", async () => {
    audioBuilder.lt.mockResolvedValueOnce({ data: [{ id: 'a1' }, { id: 'a2' }], error: null });
    videoBuilder.lt.mockResolvedValueOnce({ data: [{ id: 'v1' }], error: null });

    const counts = await sweepStuckSessionsOnce();

    expect(audioBuilder.eq).toHaveBeenCalledWith('status', 'uploaded');
    expect(audioBuilder.lt).toHaveBeenCalledWith('updated_at', expect.any(String));
    expect(mockProcessAudio).toHaveBeenCalledWith('a1');
    expect(mockProcessAudio).toHaveBeenCalledWith('a2');
    expect(mockProcessVideo).toHaveBeenCalledWith('v1');
    expect(counts).toEqual({ audio: 2, video: 1 });
  });

  it('isolates per-session failures — one bad session never starves the sweep', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    audioBuilder.lt.mockResolvedValueOnce({ data: [{ id: 'a1' }, { id: 'a2' }], error: null });
    mockProcessAudio.mockRejectedValueOnce(new Error('boom'));

    const counts = await sweepStuckSessionsOnce();

    expect(mockProcessAudio).toHaveBeenCalledTimes(2);
    expect(counts.audio).toBe(2);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('sweeps nothing when nothing is stuck', async () => {
    const counts = await sweepStuckSessionsOnce();
    expect(mockProcessAudio).not.toHaveBeenCalled();
    expect(mockProcessVideo).not.toHaveBeenCalled();
    expect(counts).toEqual({ audio: 0, video: 0 });
  });
});
