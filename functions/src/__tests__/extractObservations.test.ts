import {
  createMockFirestore,
  createMockFieldValue,
  createMockDoc,
  createMockQuerySnapshot,
  createMockVertexAI,
} from '../__mocks__/firebaseAdmin';

const { db, mockBatch } = createMockFirestore();
const fieldValue = createMockFieldValue();

const aiResponse = JSON.stringify([
  {
    swimmerName: 'Jane Smith',
    observation: 'Great catch position on freestyle',
    tags: ['technique', 'freestyle'],
    confidence: 0.9,
  },
  {
    swimmerName: 'Unknown Person',
    observation: 'Good kick tempo',
    tags: ['kick'],
    confidence: 0.6,
  },
]);

const { MockVertexAI, mockGenerateContent } = createMockVertexAI(aiResponse);

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: MockVertexAI,
}));

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    { FieldValue: fieldValue },
  ),
}));

jest.mock('../ai/prompts', () => ({
  getPrompt: jest.fn().mockReturnValue('Extract observations from transcription'),
}));

import { extractObservations } from '../ai/extractObservations';

describe('extractObservations', () => {
  const swimmers = [
    createMockDoc('s1', {
      firstName: 'Jane',
      lastName: 'Smith',
      displayName: 'Jane Smith',
      active: true,
      group: 'Gold',
    }),
    createMockDoc('s2', {
      firstName: 'Bob',
      lastName: 'Jones',
      displayName: 'Bob Jones',
      active: true,
      group: 'Gold',
    }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the swimmer query chain
    const mockSwimmerQuery = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(createMockQuerySnapshot(swimmers)),
    };

    db.collection.mockImplementation((path: string) => {
      if (path === 'swimmers') return mockSwimmerQuery;
      // drafts collection
      return { doc: jest.fn().mockReturnValue({ id: 'draft-id' }) };
    });

    mockGenerateContent.mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: aiResponse }] } }],
      },
    });
  });

  it('should extract observations and create draft docs', async () => {
    await extractObservations('session-1', 'Jane had a great catch today', 'Gold');

    expect(MockVertexAI).toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalled();
    // Only Jane Smith matches, Unknown Person is skipped
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    expect(mockBatch.commit).toHaveBeenCalled();

    const setCall = mockBatch.set.mock.calls[0][1];
    expect(setCall.swimmerId).toBe('s1');
    expect(setCall.observation).toBe('Great catch position on freestyle');
  });

  it('should filter group-specific swimmers when group is provided', async () => {
    const mockSwimmerQuery = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(createMockQuerySnapshot(swimmers)),
    };
    db.collection.mockImplementation((path: string) => {
      if (path === 'swimmers') return mockSwimmerQuery;
      return { doc: jest.fn().mockReturnValue({ id: 'draft-id' }) };
    });

    await extractObservations('session-1', 'Some transcription', 'Gold');

    // Should call where('active', '==', true) and where('group', '==', 'Gold')
    expect(mockSwimmerQuery.where).toHaveBeenCalledWith('active', '==', true);
    expect(mockSwimmerQuery.where).toHaveBeenCalledWith('group', '==', 'Gold');
  });

  it('should not filter by group when group is null', async () => {
    const mockWhere = jest.fn().mockReturnThis();
    const mockSwimmerQuery = {
      where: mockWhere,
      get: jest.fn().mockResolvedValue(createMockQuerySnapshot(swimmers)),
    };
    db.collection.mockImplementation((path: string) => {
      if (path === 'swimmers') return mockSwimmerQuery;
      return { doc: jest.fn().mockReturnValue({ id: 'draft-id' }) };
    });

    await extractObservations('session-1', 'Some transcription', null);

    // Should only call where('active', '==', true), NOT where('group', ...)
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledWith('active', '==', true);
  });

  it('should handle empty AI response gracefully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: '[]' }] } }] },
    });

    await extractObservations('session-1', 'No swimmers mentioned', null);

    expect(mockBatch.set).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('should handle unparseable AI response gracefully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: 'not json' }] } }] },
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await extractObservations('session-1', 'Some text', null);

    expect(consoleSpy).toHaveBeenCalled();
    expect(mockBatch.set).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should filter invalid tags from observations', async () => {
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
                      observation: 'Good work',
                      tags: ['technique', 'invalid_tag', 'freestyle'],
                      confidence: 0.8,
                    },
                  ]),
                },
              ],
            },
          },
        ],
      },
    });

    await extractObservations('session-1', 'Jane did well', 'Gold');

    const setCall = mockBatch.set.mock.calls[0][1];
    expect(setCall.tags).toEqual(['technique', 'freestyle']);
    expect(setCall.tags).not.toContain('invalid_tag');
  });

  it('should clamp confidence to 0-1 range', async () => {
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
                      observation: 'Good work',
                      tags: ['technique'],
                      confidence: 1.5,
                    },
                  ]),
                },
              ],
            },
          },
        ],
      },
    });

    await extractObservations('session-1', 'Jane was great', 'Gold');

    const setCall = mockBatch.set.mock.calls[0][1];
    expect(setCall.confidence).toBe(1);
  });
});
