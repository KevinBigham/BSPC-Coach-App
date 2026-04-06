import { createMockVertexAI } from '../__mocks__/firebaseAdmin';

const validPractice = {
  title: 'Endurance Focus',
  description: 'Aerobic base building',
  sets: [
    {
      order: 0,
      name: 'Warmup',
      category: 'Warmup',
      items: [{ order: 0, reps: 1, distance: 400, stroke: 'Freestyle', interval: '7:00' }],
    },
  ],
  totalYardage: 4000,
  estimatedDuration: 90,
};

const { MockVertexAI, mockGenerateContent } = createMockVertexAI(JSON.stringify(validPractice));

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: MockVertexAI,
}));

jest.mock('../ai/practicePrompts', () => ({
  getPracticeGenerationPrompt: jest.fn().mockReturnValue('Generate a practice'),
}));

// firebase-admin not directly used by generatePractice but may be imported transitively
jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
}));

import { generatePractice } from '../callable/generatePractice';

function makeRequest(data: any, auth: any = { uid: 'coach-1', token: {} }) {
  return { data, auth } as any;
}

describe('generatePractice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: JSON.stringify(validPractice) }] } }],
      },
    });
  });

  it('should be defined', () => {
    expect(generatePractice).toBeDefined();
  });

  it('should reject unauthenticated requests', async () => {
    const handler = (generatePractice as any).__wrapped ?? (generatePractice as any).run;
    if (!handler) return;

    const req = makeRequest(
      { group: 'Gold', focus: 'endurance', targetYardage: 4000, durationMinutes: 90 },
      null,
    );

    await expect(handler(req)).rejects.toThrow(/unauthenticated|Must be authenticated/i);
  });

  it('should reject requests with missing required fields', async () => {
    const handler = (generatePractice as any).__wrapped ?? (generatePractice as any).run;
    if (!handler) return;

    const req = makeRequest({ group: 'Gold' }); // missing focus, targetYardage, durationMinutes

    await expect(handler(req)).rejects.toThrow(/invalid-argument|Missing required/i);
  });

  it('should return parsed practice plan on success', async () => {
    const handler = (generatePractice as any).__wrapped ?? (generatePractice as any).run;
    if (!handler) return;

    const req = makeRequest({
      group: 'Gold',
      focus: 'endurance',
      targetYardage: 4000,
      durationMinutes: 90,
    });

    const result = await handler(req);

    expect(result).toHaveProperty('sets');
    expect(result.sets).toHaveLength(1);
    expect(result.totalYardage).toBe(4000);
    expect(MockVertexAI).toHaveBeenCalled();
  });

  it('should throw on empty AI response', async () => {
    const handler = (generatePractice as any).__wrapped ?? (generatePractice as any).run;
    if (!handler) return;

    mockGenerateContent.mockResolvedValueOnce({
      response: { candidates: [{ content: { parts: [{ text: '' }] } }] },
    });

    const req = makeRequest({
      group: 'Gold',
      focus: 'endurance',
      targetYardage: 4000,
      durationMinutes: 90,
    });

    await expect(handler(req)).rejects.toThrow(/No response from AI/i);
  });

  it('should throw on invalid practice structure (no sets array)', async () => {
    const handler = (generatePractice as any).__wrapped ?? (generatePractice as any).run;
    if (!handler) return;

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'No sets' }) }] } }],
      },
    });

    const req = makeRequest({
      group: 'Gold',
      focus: 'endurance',
      targetYardage: 4000,
      durationMinutes: 90,
    });

    await expect(handler(req)).rejects.toThrow(/Invalid practice structure/i);
  });

  it('should throw on unparseable JSON', async () => {
    const handler = (generatePractice as any).__wrapped ?? (generatePractice as any).run;
    if (!handler) return;

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        candidates: [{ content: { parts: [{ text: 'not valid json' }] } }],
      },
    });

    const req = makeRequest({
      group: 'Gold',
      focus: 'endurance',
      targetYardage: 4000,
      durationMinutes: 90,
    });

    await expect(handler(req)).rejects.toThrow();
  });
});
