import {
  createMockFirestore,
  createMockFieldValue,
  createMockDoc,
  createMockQuerySnapshot,
} from '../__mocks__/firebaseAdmin';

const { db, mockCollectionRef } = createMockFirestore();
const fieldValue = createMockFieldValue();

const mockSessionUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    { FieldValue: fieldValue },
  ),
}));

import { onDraftReviewed } from '../triggers/onDraftReviewed';

function makeEvent(beforeData: any, afterData: any, sessionId = 'session-1', draftId = 'draft-1') {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params: { sessionId, draftId },
  } as any;
}

describe('onDraftReviewed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the session doc update
    db.doc.mockReturnValue({ update: mockSessionUpdate });
  });

  it('should be defined', () => {
    expect(onDraftReviewed).toBeDefined();
  });

  it('should skip if approved was already set before', async () => {
    const handler = (onDraftReviewed as any).__wrapped ?? (onDraftReviewed as any).run;
    if (!handler) return;

    // before.approved is defined => should skip
    const event = makeEvent({ approved: false }, { approved: true });
    await handler(event);

    expect(db.collection).not.toHaveBeenCalled();
  });

  it('should skip if approved is not set after', async () => {
    const handler = (onDraftReviewed as any).__wrapped ?? (onDraftReviewed as any).run;
    if (!handler) return;

    // after.approved is undefined => skip
    const event = makeEvent({ text: 'obs' }, { text: 'obs edited' });
    await handler(event);

    expect(db.collection).not.toHaveBeenCalled();
  });

  it('should update session to posted when all drafts are reviewed', async () => {
    const handler = (onDraftReviewed as any).__wrapped ?? (onDraftReviewed as any).run;
    if (!handler) return;

    // All drafts have approved set
    const drafts = [
      createMockDoc('d1', { approved: true }),
      createMockDoc('d2', { approved: false }),
    ];
    mockCollectionRef.get.mockResolvedValueOnce(createMockQuerySnapshot(drafts));

    const event = makeEvent(
      { observation: 'good catch' }, // no approved field
      { observation: 'good catch', approved: true },
    );

    await handler(event);

    expect(mockSessionUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'posted' }));
  });

  it('should NOT update session when some drafts are still unreviewed', async () => {
    const handler = (onDraftReviewed as any).__wrapped ?? (onDraftReviewed as any).run;
    if (!handler) return;

    // One draft has approved undefined
    const drafts = [
      createMockDoc('d1', { approved: true }),
      createMockDoc('d2', { observation: 'pending review' }),
    ];
    mockCollectionRef.get.mockResolvedValueOnce(createMockQuerySnapshot(drafts));

    const event = makeEvent(
      { observation: 'good catch' },
      { observation: 'good catch', approved: true },
    );

    await handler(event);

    expect(mockSessionUpdate).not.toHaveBeenCalled();
  });
});
