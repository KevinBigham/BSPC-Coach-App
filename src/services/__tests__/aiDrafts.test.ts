jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-note-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  serverTimestamp: jest.fn(() => new Date()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { approveDraft, rejectDraft, approveAllDrafts, checkAndCompleteSession } from '../aiDrafts';
import type { AIDraft, Swimmer } from '../../types/firestore.types';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

const mockDraft: AIDraft = {
  swimmerId: 'sw-1',
  swimmerName: 'Jane Doe',
  observation: 'Good pull pattern',
  tags: ['technique'],
  confidence: 0.9,
} as AIDraft;

const consentedSwimmer: Swimmer = {
  firstName: 'Jane',
  lastName: 'Doe',
  displayName: 'Jane Doe',
  dateOfBirth: new Date('2012-01-01T00:00:00Z'),
  gender: 'F',
  group: 'Gold',
  active: true,
  strengths: [],
  weaknesses: [],
  techniqueFocusAreas: [],
  goals: [],
  parentContacts: [],
  meetSchedule: [],
  mediaConsent: { granted: true, date: new Date('2026-04-01T00:00:00Z') },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'coach-1',
};

const blockedSwimmer: Swimmer = {
  ...consentedSwimmer,
  mediaConsent: { granted: false, date: new Date('2026-04-01T00:00:00Z') },
};

const assertApproveDraftRequiresRosterContext = () => {
  // @ts-expect-error approveDraft requires a swimmer roster context argument.
  void approveDraft('session-1', 'draft-1', mockDraft, 'coach-1', undefined, undefined);
};
void assertApproveDraftRequiresRosterContext;

const assertApproveAllDraftsRequiresRosterContext = () => {
  // @ts-expect-error approveAllDrafts requires a swimmersById roster context argument.
  void approveAllDrafts([{ ...mockDraft, id: 'd1', sessionId: 's1' }], 'coach-1', 'Coach Kevin');
};
void assertApproveAllDraftsRequiresRosterContext;

describe('approveDraft', () => {
  it('marks the draft as approved', async () => {
    await approveDraft(
      'session-1',
      'draft-1',
      mockDraft,
      'coach-1',
      undefined,
      undefined,
      consentedSwimmer,
    );
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio_sessions/session-1/drafts/draft-1' }),
      expect.objectContaining({ approved: true, reviewedBy: 'coach-1' }),
    );
  });

  it('creates a swimmer note with the observation', async () => {
    await approveDraft(
      'session-1',
      'draft-1',
      mockDraft,
      'coach-1',
      undefined,
      undefined,
      consentedSwimmer,
    );
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'swimmers/sw-1/notes' }),
      expect.objectContaining({
        content: 'Good pull pattern',
        tags: ['technique'],
        source: 'audio_ai',
      }),
    );
  });

  it('uses edited content and tags when provided', async () => {
    await approveDraft(
      'session-1',
      'draft-1',
      mockDraft,
      'coach-1',
      'Edited observation',
      ['speed'],
      consentedSwimmer,
    );
    const noteData = firestore.addDoc.mock.calls[0][1];
    expect(noteData.content).toBe('Edited observation');
    expect(noteData.tags).toEqual(['speed']);
  });

  it('rejects when roster context is present but media consent is missing', async () => {
    await expect(
      approveDraft(
        'session-1',
        'draft-1',
        mockDraft,
        'coach-1',
        undefined,
        undefined,
        blockedSwimmer,
      ),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });
});

describe('rejectDraft', () => {
  it('marks the draft as rejected', async () => {
    await rejectDraft('session-1', 'draft-1', 'coach-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio_sessions/session-1/drafts/draft-1' }),
      expect.objectContaining({ approved: false, reviewedBy: 'coach-1' }),
    );
  });
});

describe('approveAllDrafts', () => {
  it('returns the count of approved drafts', async () => {
    const drafts = [
      { ...mockDraft, id: 'd1', sessionId: 's1' },
      { ...mockDraft, id: 'd2', sessionId: 's1', swimmerId: 'sw-2' },
    ];
    const swimmersById = new Map([
      ['sw-1', consentedSwimmer],
      ['sw-2', { ...consentedSwimmer, displayName: 'Swimmer Two' }],
    ]);
    const count = await approveAllDrafts(drafts, 'coach-1', 'Coach Kevin', swimmersById);
    expect(count).toBe(2);
  });

  it('commits batch with updates for each draft', async () => {
    const drafts = [{ ...mockDraft, id: 'd1', sessionId: 's1' }];
    await approveAllDrafts(drafts, 'coach-1', 'Coach Kevin', new Map([['sw-1', consentedSwimmer]]));
    const batch = firestore.writeBatch.mock.results[0].value;
    expect(batch.update).toHaveBeenCalled();
    expect(batch.set).toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalled();
  });

  it('rejects before committing when the roster map lacks a draft swimmer', async () => {
    const drafts = [{ ...mockDraft, id: 'd1', sessionId: 's1' }];

    await expect(approveAllDrafts(drafts, 'coach-1', 'Coach Kevin', new Map())).rejects.toThrow(
      /roster context/i,
    );
    expect(firestore.writeBatch).not.toHaveBeenCalled();
  });
});

describe('checkAndCompleteSession', () => {
  it('marks session as posted when all drafts are reviewed', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [{ data: () => ({ approved: true }) }, { data: () => ({ approved: false }) }],
    });
    await checkAndCompleteSession('session-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio_sessions/session-1' }),
      expect.objectContaining({ status: 'posted' }),
    );
  });

  it('does not mark session when some drafts are unreviewed', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [{ data: () => ({ approved: true }) }, { data: () => ({ approved: undefined }) }],
    });
    await checkAndCompleteSession('session-1');
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('does not mark session when there are no drafts', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });
    await checkAndCompleteSession('session-1');
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});
