// Phase F: the audio pipeline core (processAudioSessionById) + its HTTPS
// entry point. The Firestore trigger-mechanics tests (before/after snapshot,
// status-didn't-change) retired with the trigger; their guard subject lives
// on as the status='uploaded' idempotency gate, pinned here. The pipeline
// logic pins (status walk, empty transcription, failure capture) kept their
// subjects.
import { createMockVertexAI } from '../__mocks__/firebaseAdmin';

const { MockVertexAI, mockGenerateContent } = createMockVertexAI(
  'Transcribed coaching session text',
);

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: MockVertexAI,
}));

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  storage: jest.fn(() => ({ bucket: jest.fn() })),
}));

const mockExtractObservations = jest.fn().mockResolvedValue(undefined);
jest.mock('../ai/extractObservations', () => ({
  extractObservations: mockExtractObservations,
}));

// Canonical sessions + junction + the media-audio bucket (service role)
interface SessionsBuilder {
  select: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
}
interface JunctionBuilder {
  select: jest.Mock;
  eq: jest.Mock;
}
const sessionsBuilder: SessionsBuilder = {
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn(),
  maybeSingle: jest.fn(),
};
const junctionBuilder: JunctionBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn(),
};
const mockDownload = jest.fn();
const mockSupabaseFrom = jest.fn((table: string) =>
  table === 'audio_session_swimmers' ? junctionBuilder : sessionsBuilder,
);

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => mockSupabaseFrom(table),
    storage: { from: () => ({ download: (path: string) => mockDownload(path) }) },
  },
}));

import { processAudioSessionById } from '../media/pipeline';
import { processAudioSession } from '../https/processSession';

const sessionRow = {
  id: 'sess-1',
  storage_path: 'audio/c1/2026-06-09/audio_1.m4a',
  practice_group: 'Gold',
  status: 'uploaded',
};

function primeSession(row: Record<string, unknown> | null) {
  sessionsBuilder.maybeSingle.mockResolvedValue({ data: row, error: null });
  // select().eq() ends in maybeSingle for the read; update().eq() resolves
  sessionsBuilder.eq.mockImplementation(() => ({
    maybeSingle: sessionsBuilder.maybeSingle,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }));
  junctionBuilder.eq.mockResolvedValue({
    data: [{ swimmer_id: 'sw-1' }, { swimmer_id: 'sw-2' }],
    error: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  primeSession(sessionRow);
  mockDownload.mockResolvedValue({
    data: { arrayBuffer: () => Promise.resolve(Buffer.from('audio-bytes').buffer) },
    error: null,
  });
  mockGenerateContent.mockResolvedValue({
    response: {
      candidates: [{ content: { parts: [{ text: 'Transcribed coaching session text' }] } }],
    },
  });
});

describe('processAudioSessionById', () => {
  it('no-ops for an unknown session (sweeper-safe)', async () => {
    primeSession(null);
    await processAudioSessionById('ghost');
    expect(sessionsBuilder.update).not.toHaveBeenCalled();
  });

  it("no-ops unless the session is in 'uploaded' (the idempotency gate)", async () => {
    primeSession({ ...sessionRow, status: 'transcribing' });
    await processAudioSessionById('sess-1');
    expect(sessionsBuilder.update).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('walks the status machine: transcribing -> transcription+extracting -> review, reading the file from media-audio', async () => {
    await processAudioSessionById('sess-1');

    expect(mockDownload).toHaveBeenCalledWith('audio/c1/2026-06-09/audio_1.m4a');
    expect(mockGenerateContent).toHaveBeenCalled();

    const patches = sessionsBuilder.update.mock.calls.map((c) => c[0]);
    expect(patches[0]).toEqual({ status: 'transcribing' });
    expect(patches[1]).toEqual({
      transcription: 'Transcribed coaching session text',
      status: 'extracting',
    });
    expect(patches[2]).toEqual({ status: 'review' });
  });

  it('hands extractObservations the junction-derived swimmer ids (P1-4)', async () => {
    await processAudioSessionById('sess-1');
    expect(mockExtractObservations).toHaveBeenCalledWith(
      'sess-1',
      'Transcribed coaching session text',
      'Gold',
      ['sw-1', 'sw-2'],
    );
  });

  it('sets failed + error_message on empty transcription', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: '' }] } }] },
    });
    await processAudioSessionById('sess-1');
    const patches = sessionsBuilder.update.mock.calls.map((c) => c[0]);
    expect(patches[patches.length - 1]).toEqual({
      status: 'failed',
      error_message: 'Empty transcription',
    });
    expect(mockExtractObservations).not.toHaveBeenCalled();
  });

  it('captures pipeline errors as failed + error_message', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockDownload.mockResolvedValueOnce({ data: null, error: new Error('object not found') });
    await processAudioSessionById('sess-1');
    const patches = sessionsBuilder.update.mock.calls.map((c) => c[0]);
    expect(patches[patches.length - 1]).toEqual({
      status: 'failed',
      error_message: 'object not found',
    });
    consoleSpy.mockRestore();
  });
});

describe('processAudioSession (HTTPS entry, D-F2)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, PROCESS_SHARED_SECRET: 'test-secret' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  function makeReqRes(headers: Record<string, string>, body: unknown, method = 'POST') {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    const req = {
      method,
      get: (name: string) => headers[name.toLowerCase()],
      body,
    };
    return { req, res };
  }

  it('401s without the shared secret — and runs nothing', async () => {
    const { req, res } = makeReqRes({}, { sessionId: 'sess-1' });
    await (processAudioSession as unknown as (q: unknown, s: unknown) => Promise<void>)(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(sessionsBuilder.update).not.toHaveBeenCalled();
  });

  it('400s without a sessionId', async () => {
    const { req, res } = makeReqRes({ 'x-process-secret': 'test-secret' }, {});
    await (processAudioSession as unknown as (q: unknown, s: unknown) => Promise<void>)(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('runs the pipeline and 200s with the secret + sessionId', async () => {
    const { req, res } = makeReqRes({ 'x-process-secret': 'test-secret' }, { sessionId: 'sess-1' });
    await (processAudioSession as unknown as (q: unknown, s: unknown) => Promise<void>)(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockDownload).toHaveBeenCalled(); // the core actually ran
  });
});
