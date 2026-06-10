// Phase F: re-pointed at canonical audio_sessions (Supabase). Same critical
// subjects — session creation shape, lifecycle walking — plus the D-F2 pin:
// the pipeline kick fires exactly once, on the flip to 'uploaded'.
jest.mock('../../src/config/supabase', () => {
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'sess-AUD-fixture' }, error: null })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __query: query };
});

jest.mock('../../src/services/mediaPipeline', () => ({
  requestSessionProcessing: jest.fn().mockResolvedValue(undefined),
}));

import { createAudioSession, updateAudioSession } from '../../src/services/audio';
import { requestSessionProcessing } from '../../src/services/mediaPipeline';
import { buildAudioSession, buildCoach } from '../fixtures/coach';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../src/config/supabase');
const { supabase, __query } = mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('audio.createAudioSession (critical op)', () => {
  it('happy path: writes the session in the uploading state and the P1-4 junction rows', async () => {
    const coach = buildCoach();
    const id = await createAudioSession(
      coach.uid,
      coach.displayName,
      600,
      '2026-04-28',
      ['swimmer-001'],
      'Gold',
    );

    expect(id).toBe('sess-AUD-fixture');
    expect(supabase.from).toHaveBeenCalledWith('audio_sessions');
    expect(supabase.from).toHaveBeenCalledWith('audio_session_swimmers');
    expect(__query.insert.mock.calls[0][0]).toMatchObject({
      coach_id: coach.uid,
      duration_sec: 600,
      practice_date: '2026-04-28',
      practice_group: 'Gold',
      status: 'uploading',
      storage_path: '',
    });
    expect(__query.insert.mock.calls[1][0]).toEqual([
      { session_id: 'sess-AUD-fixture', swimmer_id: 'swimmer-001' },
    ]);
  });

  it('edge: defaults practice_group to null when omitted', async () => {
    const coach = buildCoach();
    await createAudioSession(coach.uid, coach.displayName, 300, '2026-04-28', ['swimmer-001']);
    expect(__query.insert.mock.calls[0][0].practice_group).toBeNull();
  });

  it('failure-shape: timestamps and the coach-name denorm are NOT client-written (DB-owned / derived on read)', async () => {
    const coach = buildCoach();
    await createAudioSession(coach.uid, coach.displayName, 60, '2026-04-28', ['swimmer-001']);
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('coach_name');
  });
});

describe('audio session lifecycle', () => {
  it('walks the documented status sequence and kicks the pipeline exactly once — on uploaded (D-F2)', async () => {
    const session = buildAudioSession({ index: 1, status: 'uploading' });
    const sequence: Array<typeof session.status> = [
      'uploaded',
      'transcribing',
      'extracting',
      'review',
      'posted',
    ];

    for (const status of sequence) {
      await updateAudioSession(session.id, { status });
    }

    expect(__query.update).toHaveBeenCalledTimes(sequence.length);
    sequence.forEach((status, i) => {
      expect(__query.update.mock.calls[i][0]).toEqual({ status });
    });
    expect(requestSessionProcessing).toHaveBeenCalledTimes(1);
    expect(requestSessionProcessing).toHaveBeenCalledWith('audio', session.id);
  });
});
