/**
 * Shared Firebase Admin mock factory.
 * Each test file calls `createMockAdmin()` to get a fresh set of mocks.
 */

export interface MockDocSnapshot {
  exists: boolean;
  id: string;
  data: () => any;
  ref: { update: jest.Mock };
}

export interface MockQuerySnapshot {
  empty: boolean;
  size: number;
  docs: MockDocSnapshot[];
}

export function createMockDoc(id: string, data: any, exists = true): MockDocSnapshot {
  return {
    exists,
    id,
    data: () => data,
    ref: { update: jest.fn().mockResolvedValue(undefined) },
  };
}

export function createMockQuerySnapshot(docs: MockDocSnapshot[]): MockQuerySnapshot {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
  };
}

export function createMockFirestore() {
  const mockBatch = {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const mockTransaction = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCollectionRef = {
    doc: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue(createMockDoc('mock-id', {})),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    }),
    get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    add: jest.fn().mockResolvedValue({ id: 'new-doc-id' }),
  };

  const mockDocRef = {
    get: jest.fn().mockResolvedValue(createMockDoc('mock-id', {})),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const db = {
    doc: jest.fn().mockReturnValue(mockDocRef),
    collection: jest.fn().mockReturnValue(mockCollectionRef),
    collectionGroup: jest.fn().mockReturnValue(mockCollectionRef),
    batch: jest.fn().mockReturnValue(mockBatch),
    runTransaction: jest.fn().mockImplementation(async (fn: any) => fn(mockTransaction)),
  };

  return { db, mockBatch, mockTransaction, mockCollectionRef, mockDocRef };
}

export function createMockStorage() {
  const mockFile = {
    download: jest.fn().mockResolvedValue([Buffer.from('fake-file-data')]),
    getMetadata: jest.fn().mockResolvedValue([{ size: '1000', contentType: 'video/mp4' }]),
  };

  const mockBucket = {
    file: jest.fn().mockReturnValue(mockFile),
    name: 'test-bucket',
  };

  const storage = {
    bucket: jest.fn().mockReturnValue(mockBucket),
  };

  return { storage, mockBucket, mockFile };
}

export function createMockMessaging() {
  return {
    send: jest.fn().mockResolvedValue('message-id'),
    sendEachForMulticast: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0 }),
    subscribeToTopic: jest.fn().mockResolvedValue(undefined),
    unsubscribeFromTopic: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockFieldValue() {
  return {
    serverTimestamp: jest.fn().mockReturnValue('SERVER_TIMESTAMP'),
    arrayUnion: jest
      .fn()
      .mockImplementation((...args: any[]) => ({ _type: 'arrayUnion', values: args })),
    arrayRemove: jest
      .fn()
      .mockImplementation((...args: any[]) => ({ _type: 'arrayRemove', values: args })),
  };
}

export function createMockVertexAI(responseText: string) {
  const mockGenerateContent = jest.fn().mockResolvedValue({
    response: {
      candidates: [{ content: { parts: [{ text: responseText }] } }],
    },
  });

  const mockModel = {
    generateContent: mockGenerateContent,
  };

  const MockVertexAI = jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue(mockModel),
  }));

  return { MockVertexAI, mockModel, mockGenerateContent };
}
