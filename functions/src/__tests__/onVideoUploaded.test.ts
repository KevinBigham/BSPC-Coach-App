import {
  createMockFirestore,
  createMockStorage,
  createMockFieldValue,
  createMockVertexAI,
  createMockDoc,
} from '../__mocks__/firebaseAdmin';

const { db, mockDocRef, mockBatch } = createMockFirestore();
const { storage, mockFile } = createMockStorage();
const fieldValue = createMockFieldValue();

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    { FieldValue: fieldValue },
  ),
  storage: jest.fn(() => storage),
}));

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
]);

const { MockVertexAI, mockGenerateContent } = createMockVertexAI(validAIResponse);

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: MockVertexAI,
}));

jest.mock('../ai/videoPrompts', () => ({
  getVideoAnalysisPrompt: jest.fn().mockReturnValue('Analyze this video'),
}));

import { onVideoUploaded } from '../triggers/onVideoUploaded';

function makeEvent(beforeData: any, afterData: any, sessionId = 'vid-1') {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params: { sessionId },
  } as any;
}

describe('onVideoUploaded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocRef.update.mockResolvedValue(undefined);

    // Default: swimmer lookup returns a result
    db.doc.mockImplementation((path: string) => {
      if (path.startsWith('swimmers/')) {
        return {
          get: jest
            .fn()
            .mockResolvedValue(
              createMockDoc('swimmer-1', { firstName: 'Jane', lastName: 'Smith' }),
            ),
        };
      }
      return mockDocRef;
    });

    // Mock collection for drafts
    const mockDraftCollection = {
      doc: jest.fn().mockReturnValue({ id: 'draft-1' }),
    };
    db.collection.mockReturnValue(mockDraftCollection as any);
  });

  it('should be defined', () => {
    expect(onVideoUploaded).toBeDefined();
  });

  it('should skip if status did not change to uploaded', async () => {
    const handler = (onVideoUploaded as any).__wrapped ?? (onVideoUploaded as any).run;
    if (!handler) return;

    const event = makeEvent({ status: 'uploaded' }, { status: 'uploaded' });
    await handler(event);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it('should process video for small files (inline base64)', async () => {
    const handler = (onVideoUploaded as any).__wrapped ?? (onVideoUploaded as any).run;
    if (!handler) return;

    // Small file: under 20MB
    mockFile.getMetadata.mockResolvedValueOnce([{ size: '1000', contentType: 'video/mp4' }]);

    const event = makeEvent(
      { status: 'pending' },
      {
        status: 'uploaded',
        storagePath: 'video/test.mp4',
        taggedSwimmerIds: ['swimmer-1'],
        group: 'Gold',
      },
    );

    await handler(event);

    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'analyzing' }),
    );
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(mockBatch.set).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
    expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'review' }));
  });

  it('should use GCS URI for large files', async () => {
    const handler = (onVideoUploaded as any).__wrapped ?? (onVideoUploaded as any).run;
    if (!handler) return;

    // Large file: over 20MB
    mockFile.getMetadata.mockResolvedValueOnce([
      {
        size: String(25 * 1024 * 1024),
        contentType: 'video/mp4',
      },
    ]);

    const event = makeEvent(
      { status: 'pending' },
      { status: 'uploaded', storagePath: 'video/big.mp4', taggedSwimmerIds: [], group: null },
    );

    await handler(event);

    // Should use fileData (GCS URI) instead of inlineData
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const parts = callArgs.contents[0].parts;
    expect(parts[0]).toHaveProperty('fileData');
  });

  it('should fail on empty AI response', async () => {
    const handler = (onVideoUploaded as any).__wrapped ?? (onVideoUploaded as any).run;
    if (!handler) return;

    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: '' }] } }] },
    });

    const event = makeEvent(
      { status: 'pending' },
      { status: 'uploaded', storagePath: 'video/test.mp4', taggedSwimmerIds: [], group: null },
    );

    await handler(event);

    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorMessage: 'Empty AI response' }),
    );
  });

  it('should fail on unparseable JSON', async () => {
    const handler = (onVideoUploaded as any).__wrapped ?? (onVideoUploaded as any).run;
    if (!handler) return;

    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] },
    });

    const event = makeEvent(
      { status: 'pending' },
      { status: 'uploaded', storagePath: 'video/test.mp4', taggedSwimmerIds: [], group: null },
    );

    await handler(event);

    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'Could not parse AI response as JSON',
      }),
    );
  });

  it('should set status to failed on error', async () => {
    const handler = (onVideoUploaded as any).__wrapped ?? (onVideoUploaded as any).run;
    if (!handler) return;

    mockFile.getMetadata.mockRejectedValueOnce(new Error('Storage error'));

    const event = makeEvent(
      { status: 'pending' },
      { status: 'uploaded', storagePath: 'video/test.mp4', taggedSwimmerIds: [], group: null },
    );

    await handler(event);

    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorMessage: 'Storage error' }),
    );
  });
});
