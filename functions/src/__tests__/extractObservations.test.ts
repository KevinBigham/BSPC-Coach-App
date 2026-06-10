import {
  createMockFirestore,
  createMockFieldValue,
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

// Drafts batch write stays on Firestore (UNIFY Phase F)
jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    { FieldValue: fieldValue },
  ),
}));

// Roster reads come from canonical swimmers (UNIFY Phase B)
jest.mock('../config/supabase', () => {
  const state: { rows: unknown[] } = { rows: [] };
  interface QueryMock {
    select: jest.Mock;
    eq: jest.Mock;
    in: jest.Mock;
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
  }
  const query: QueryMock = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => query),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.rows, error: null }).then(resolve, reject),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __state: state, __query: query };
});

jest.mock('../ai/prompts', () => ({
  getPrompt: jest.fn().mockReturnValue('Extract observations from transcription'),
}));

import { extractObservations } from '../ai/extractObservations';
import { getPrompt } from '../ai/prompts';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../config/supabase');
const { __state, __query } = supabaseMock;
const mockSupabase = supabaseMock.supabase;

describe('extractObservations', () => {
  const rosterRows = [
    { id: 's1', first_name: 'Jane', last_name: 'Smith', display_name: 'Jane Smith' },
    { id: 's2', first_name: 'Bob', last_name: 'Jones', display_name: 'Bob Jones' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    __state.rows = rosterRows;

    db.collection.mockImplementation(() => {
      // drafts collection (Firestore until Phase F)
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
    await extractObservations('session-1', 'Some transcription', 'Gold');

    expect(mockSupabase.from).toHaveBeenCalledWith('swimmers');
    expect(__query.eq).toHaveBeenCalledWith('is_active', true);
    expect(__query.eq).toHaveBeenCalledWith('practice_group', 'Gold');
  });

  it('should not filter by group when group is null', async () => {
    await extractObservations('session-1', 'Some transcription', null);

    expect(__query.eq).toHaveBeenCalledTimes(1);
    expect(__query.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('falls back to first+last name when display_name is null (BSPC-origin rows)', async () => {
    __state.rows = [{ id: 's1', first_name: 'Jane', last_name: 'Smith', display_name: null }];

    await extractObservations('session-1', 'Jane Smith looked sharp', 'Gold');

    // fuzzy match still resolves via the derived display name
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    expect(mockBatch.set.mock.calls[0][1].swimmerName).toBe('Jane Smith');
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

  it('passes selected swimmers into the prompt and only writes selected swimmer drafts', async () => {
    // only s1 exists; missing selected ids are simply absent from the result
    __state.rows = [
      { id: 's1', first_name: 'Jane', last_name: 'Smith', display_name: 'Jane Smith' },
    ];

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      swimmerName: 'Bob Jones',
                      observation: 'Good kick tempo',
                      tags: ['kick'],
                      confidence: 0.8,
                    },
                    {
                      swimmerName: 'Jane Smith',
                      observation: 'Great catch position',
                      tags: ['technique'],
                      confidence: 0.9,
                    },
                  ]),
                },
              ],
            },
          },
        ],
      },
    });

    await extractObservations('session-1', 'Jane and Bob did well', 'Gold', ['s1']);

    expect(__query.in).toHaveBeenCalledWith('id', ['s1']);
    expect(getPrompt).toHaveBeenCalledWith('Jane and Bob did well', 'Jane Smith', 'Gold', [
      { id: 's1', displayName: 'Jane Smith' },
    ]);
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
    expect(mockBatch.set.mock.calls[0][1].swimmerId).toBe('s1');
  });
});
