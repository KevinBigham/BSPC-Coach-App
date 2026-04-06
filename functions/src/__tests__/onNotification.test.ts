import {
  createMockFirestore,
  createMockMessaging,
  createMockFieldValue,
  createMockDoc,
} from '../__mocks__/firebaseAdmin';

const { db } = createMockFirestore();
const messaging = createMockMessaging();
const fieldValue = createMockFieldValue();
const mockCoachUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    { FieldValue: fieldValue },
  ),
  messaging: jest.fn(() => messaging),
}));

import { onNotificationCreated } from '../triggers/onNotification';

function makeEvent(data: any, notifId = 'notif-1') {
  return {
    data: { data: () => data },
    params: { notifId },
  } as any;
}

describe('onNotificationCreated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCoachUpdate.mockClear();
  });

  it('should be defined', () => {
    expect(onNotificationCreated).toBeDefined();
  });

  it('should return early if event data is null', async () => {
    const handler = (onNotificationCreated as any).__wrapped ?? (onNotificationCreated as any).run;
    if (!handler) return;

    const event = { data: { data: () => null }, params: { notifId: 'n1' } } as any;
    await handler(event);
    expect(messaging.send).not.toHaveBeenCalled();
  });

  it('should skip if coach has no FCM tokens', async () => {
    const handler = (onNotificationCreated as any).__wrapped ?? (onNotificationCreated as any).run;
    if (!handler) return;

    db.doc.mockReturnValueOnce({
      get: jest.fn().mockResolvedValue(createMockDoc('coach-1', { fcmTokens: [] })),
    });

    const event = makeEvent({ coachId: 'coach-1', title: 'Test', body: 'Hello' });
    await handler(event);

    expect(messaging.send).not.toHaveBeenCalled();
  });

  it('should send push notification to each token', async () => {
    const handler = (onNotificationCreated as any).__wrapped ?? (onNotificationCreated as any).run;
    if (!handler) return;

    db.doc.mockReturnValue({
      get: jest
        .fn()
        .mockResolvedValue(createMockDoc('coach-1', { fcmTokens: ['token-a', 'token-b'] })),
      update: mockCoachUpdate,
    });

    const event = makeEvent({
      coachId: 'coach-1',
      title: 'Practice Update',
      body: 'New notes available',
      data: { type: 'notes' },
    });

    await handler(event);

    expect(messaging.send).toHaveBeenCalledTimes(2);
    expect(messaging.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'token-a',
        notification: { title: 'Practice Update', body: 'New notes available' },
      }),
    );
  });

  it('should clean up invalid tokens', async () => {
    const handler = (onNotificationCreated as any).__wrapped ?? (onNotificationCreated as any).run;
    if (!handler) return;

    db.doc.mockReturnValue({
      get: jest
        .fn()
        .mockResolvedValue(
          createMockDoc('coach-1', { fcmTokens: ['valid-token', 'invalid-token'] }),
        ),
      update: mockCoachUpdate,
    });

    // First send succeeds, second fails with invalid token
    messaging.send
      .mockResolvedValueOnce('msg-id')
      .mockRejectedValueOnce({ code: 'messaging/registration-token-not-registered' });

    const event = makeEvent({
      coachId: 'coach-1',
      title: 'Test',
      body: 'Test body',
    });

    await handler(event);

    expect(mockCoachUpdate).toHaveBeenCalledWith({
      fcmTokens: expect.objectContaining({ _type: 'arrayRemove' }),
    });
  });

  it('should not clean up tokens on other errors', async () => {
    const handler = (onNotificationCreated as any).__wrapped ?? (onNotificationCreated as any).run;
    if (!handler) return;

    db.doc.mockReturnValue({
      get: jest.fn().mockResolvedValue(createMockDoc('coach-1', { fcmTokens: ['token-a'] })),
      update: mockCoachUpdate,
    });

    // Fail with a non-token error
    messaging.send.mockRejectedValueOnce({ code: 'messaging/internal-error' });

    const event = makeEvent({
      coachId: 'coach-1',
      title: 'Test',
      body: 'Body',
    });

    await handler(event);

    expect(mockCoachUpdate).not.toHaveBeenCalled();
  });
});
