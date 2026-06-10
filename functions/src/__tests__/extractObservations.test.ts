import { createMockVertexAI } from '../__mocks__/firebaseAdmin';

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

// Roster reads canonical since Phase B; the drafts write is canonical too as
// of Phase F — one insert into audio_session_drafts (no firebase-admin left
// in the module at all).
jest.mock('../config/supabase', () => {
  const state: { rows: unknown[] } = { rows: [] };
  interface QueryMock {
    select: jest.Mock;
    eq: jest.Mock;
    in: jest.Mock;
    insert: jest.Mock;
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
  }
  const query: QueryMock = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => query),
    insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
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

    mockGenerateContent.mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: aiResponse }] } }],
      },
    });
  });

  it('should extract observations and insert canonical draft rows', async () => {
    await extractObservations('session-1', 'Jane had a great catch today', 'Gold');

    expect(MockVertexAI).toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith('audio_session_drafts');
    // Only Jane Smith matches, Unknown Person is skipped
    expect(__query.insert).toHaveBeenCalledTimes(1);
    const rows = __query.insert.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      session_id: 'session-1',
      swimmer_id: 's1',
      observation: 'Great catch position on freestyle',
    });
    // denorm gone, timestamps DB-owned
    expect(rows[0]).not.toHaveProperty('swimmerName');
    expect(rows[0]).not.toHaveProperty('created_at');
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
    expect(__query.insert).toHaveBeenCalledTimes(1);
    expect(__query.insert.mock.calls[0][0][0].swimmer_id).toBe('s1');
  });

  it('should handle empty AI response gracefully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: '[]' }] } }] },
    });

    await extractObservations('session-1', 'No swimmers mentioned', null);

    expect(__query.insert).not.toHaveBeenCalled();
  });

  it('should handle unparseable AI response gracefully', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: 'not json' }] } }] },
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await extractObservations('session-1', 'Some text', null);

    expect(consoleSpy).toHaveBeenCalled();
    expect(__query.insert).not.toHaveBeenCalled();
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

    const row = __query.insert.mock.calls[0][0][0];
    expect(row.tags).toEqual(['technique', 'freestyle']);
    expect(row.tags).not.toContain('invalid_tag');
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
                      observation: 'Stellar set',
                      tags: ['technique'],
                      confidence: 1.7,
                    },
                  ]),
                },
              ],
            },
          },
        ],
      },
    });

    await extractObservations('session-1', 'Jane crushed it', 'Gold');

    expect(__query.insert.mock.calls[0][0][0].confidence).toBe(1);
  });

  it('scopes the roster read to selectedSwimmerIds when provided (two-pass P1-4 read)', async () => {
    await extractObservations('session-1', 'Jane had a great catch', 'Gold', ['s1']);

    expect(__query.in).toHaveBeenCalledWith('id', ['s1']);
    expect(getPrompt).toHaveBeenCalledWith(
      'Jane had a great catch',
      expect.any(String),
      'Gold',
      expect.arrayContaining([{ id: 's1', displayName: 'Jane Smith' }]),
    );
  });
});
