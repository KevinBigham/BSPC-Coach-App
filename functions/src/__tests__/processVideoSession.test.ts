// Phase F: the video pipeline core. Subjects kept from the trigger era:
// small-file inline path, large-file gs:// path (now via the TRANSIENT
// staging copy), selected-swimmer scoping, empty/unparseable AI failure,
// error capture. New pins: the junction-based roster read (RF-10 closed —
// no more Firestore swimmer docs) and the CHECK-domain coercion on draft
// rows. Trigger-mechanics tests retired with the trigger; the
// status='uploaded' idempotency gate is their successor.
const validAIResponse = JSON.stringify([
  {
    swimmerName: 'Jane Smith',
    observation: 'Good catch position',
    diagnosis: 'Elbow drops slightly',
    drillRecommendation: 'Catch-up drill',
    phase: 'stroke',
    tags: ['technique'],
    confidence: 0.85,
  },
  {
    swimmerName: 'Somebody Else',
    observation: 'Should never land',
    phase: 'stroke',
    tags: ['technique'],
    confidence: 0.5,
  },
]);

import { createMockVertexAI } from '../__mocks__/firebaseAdmin';

const { MockVertexAI, mockGenerateContent } = createMockVertexAI(validAIResponse);

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: MockVertexAI,
}));

jest.mock('../ai/videoPrompts', () => ({
  getVideoAnalysisPrompt: jest.fn().mockReturnValue('Analyze this video'),
}));

// Transient GCS staging for the >20MB Vertex path
const mockStagingDelete = jest.fn().mockResolvedValue(undefined);
const mockCreateWriteStream = jest.fn();
const mockBucketFile = jest.fn(() => ({
  createWriteStream: mockCreateWriteStream,
  delete: mockStagingDelete,
}));
jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  storage: jest.fn(() => ({
    bucket: jest.fn(() => ({ name: 'app-bucket', file: mockBucketFile })),
  })),
}));

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
interface DraftsBuilder {
  insert: jest.Mock;
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
const draftsBuilder: DraftsBuilder = {
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
};
const mockCreateSignedUrl = jest.fn();
const mockSupabaseFrom = jest.fn((table: string) => {
  if (table === 'video_session_swimmers') return junctionBuilder;
  if (table === 'video_session_drafts') return draftsBuilder;
  return sessionsBuilder;
});

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => mockSupabaseFrom(table),
    storage: {
      from: () => ({
        createSignedUrl: (path: string, exp: number) => mockCreateSignedUrl(path, exp),
      }),
    },
  },
}));

import { processVideoSessionById } from '../media/pipeline';

const sessionRow = {
  id: 'vid-1',
  storage_path: 'video/c1/2026-06-09/video_1.mp4',
  practice_group: 'Gold',
  status: 'uploaded',
};

function primeSession(row: Record<string, unknown> | null) {
  sessionsBuilder.maybeSingle.mockResolvedValue({ data: row, error: null });
  sessionsBuilder.eq.mockImplementation(() => ({
    maybeSingle: sessionsBuilder.maybeSingle,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  }));
  junctionBuilder.eq.mockResolvedValue({
    data: [
      {
        swimmer_id: 'sw-1',
        kind: 'tagged',
        swimmer: { first_name: 'Jane', last_name: 'Smith' },
      },
      {
        swimmer_id: 'sw-1',
        kind: 'selected',
        swimmer: { first_name: 'Jane', last_name: 'Smith' },
      },
    ],
    error: null,
  });
}

function primeFetch(sizeBytes: number) {
  // HEAD for size, GET for bytes (inline) or stream (staging)
  global.fetch = jest.fn(async (_url: unknown, init?: { method?: string }) => {
    if (init?.method === 'HEAD') {
      return {
        ok: true,
        headers: {
          get: (h: string) =>
            h === 'content-length' ? String(sizeBytes) : h === 'content-type' ? 'video/mp4' : null,
        },
      } as unknown as Response;
    }
    const { Readable } = await import('node:stream');
    return {
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('video-bytes').buffer),
      body: Readable.toWeb(Readable.from([Buffer.from('video-bytes')])),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

beforeEach(async () => {
  jest.clearAllMocks();
  primeSession(sessionRow);
  primeFetch(1024); // small by default
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://signed.read/video.mp4' },
    error: null,
  });
  mockGenerateContent.mockResolvedValue({
    response: { candidates: [{ content: { parts: [{ text: validAIResponse }] } }] },
  });
  const { Writable } = await import('node:stream');
  mockCreateWriteStream.mockImplementation(
    () =>
      new Writable({
        write(_chunk, _enc, cb) {
          cb();
        },
      }),
  );
});

describe('processVideoSessionById', () => {
  it("no-ops unless the session is in 'uploaded' (the idempotency gate)", async () => {
    primeSession({ ...sessionRow, status: 'analyzing' });
    await processVideoSessionById('vid-1');
    expect(sessionsBuilder.update).not.toHaveBeenCalled();
  });

  it('small file: signs the path, sends inline base64, writes canonical drafts, lands in review', async () => {
    await processVideoSessionById('vid-1');

    expect(mockCreateSignedUrl).toHaveBeenCalledWith('video/c1/2026-06-09/video_1.mp4', 600);
    const args = mockGenerateContent.mock.calls[0][0];
    expect(args.contents[0].parts[0]).toHaveProperty('inlineData');

    // drafts: ONE insert, only the matched selected swimmer, denorms dropped
    expect(draftsBuilder.insert).toHaveBeenCalledTimes(1);
    const rows = draftsBuilder.insert.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      session_id: 'vid-1',
      swimmer_id: 'sw-1',
      observation: 'Good catch position',
      diagnosis: 'Elbow drops slightly',
      drill_recommendation: 'Catch-up drill',
      phase: 'stroke',
      tags: ['technique'],
      confidence: 0.85,
    });
    expect(rows[0]).not.toHaveProperty('swimmerName');

    const patches = sessionsBuilder.update.mock.calls.map((c) => c[0]);
    expect(patches[0]).toEqual({ status: 'analyzing' });
    expect(patches[patches.length - 1]).toEqual({ status: 'review' });
  });

  it('large file: streams a TRANSIENT staging copy, sends gs://, deletes the staging object', async () => {
    primeFetch(50 * 1024 * 1024);
    await processVideoSessionById('vid-1');

    expect(mockBucketFile).toHaveBeenCalledWith('vertex-staging/vid-1.mp4');
    const args = mockGenerateContent.mock.calls[0][0];
    expect(args.contents[0].parts[0]).toEqual({
      fileData: { fileUri: 'gs://app-bucket/vertex-staging/vid-1.mp4', mimeType: 'video/mp4' },
    });
    expect(mockStagingDelete).toHaveBeenCalled(); // transient by contract
  });

  it('coerces out-of-domain AI phases/tags to the DB CHECK domains', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      swimmerName: 'Jane Smith',
                      observation: 'x',
                      phase: 'cooldown',
                      tags: ['vibes'],
                      confidence: 0.5,
                    },
                  ]),
                },
              ],
            },
          },
        ],
      },
    });
    await processVideoSessionById('vid-1');
    const rows = draftsBuilder.insert.mock.calls[0][0];
    expect(rows[0].phase).toBe('general');
    expect(rows[0].tags).toEqual(['technique']);
  });

  it('fails on empty AI response', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: '' }] } }] },
    });
    await processVideoSessionById('vid-1');
    const patches = sessionsBuilder.update.mock.calls.map((c) => c[0]);
    expect(patches[patches.length - 1]).toEqual({
      status: 'failed',
      error_message: 'Empty AI response',
    });
    expect(draftsBuilder.insert).not.toHaveBeenCalled();
  });

  it('fails on unparseable JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: 'definitely not json' }] } }] },
    });
    await processVideoSessionById('vid-1');
    const patches = sessionsBuilder.update.mock.calls.map((c) => c[0]);
    expect(patches[patches.length - 1]).toEqual({
      status: 'failed',
      error_message: 'Could not parse AI response as JSON',
    });
  });

  it('captures pipeline errors as failed + error_message', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: new Error('sign denied') });
    await processVideoSessionById('vid-1');
    const patches = sessionsBuilder.update.mock.calls.map((c) => c[0]);
    expect(patches[patches.length - 1]).toEqual({
      status: 'failed',
      error_message: 'sign denied',
    });
    consoleSpy.mockRestore();
  });
});
