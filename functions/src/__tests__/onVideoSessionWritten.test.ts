const mockRecomputeDashboardActivityAggregation = jest.fn().mockResolvedValue(undefined);

jest.mock('../triggers/dashboardAggregations', () => ({
  recomputeDashboardActivityAggregation: mockRecomputeDashboardActivityAggregation,
}));

import { onVideoSessionWritten } from '../triggers/onVideoSessionWritten';

function handlerOf(trigger: unknown) {
  return (
    (trigger as { __wrapped?: unknown; run?: unknown }).__wrapped ??
    (trigger as { run?: unknown }).run
  );
}

function makeEvent(beforeData?: Record<string, unknown>, afterData?: Record<string, unknown>) {
  return {
    data: {
      before: { data: () => beforeData },
      after: { data: () => afterData },
    },
    params: { sessionId: 'video-1' },
  } as any;
}

describe('onVideoSessionWritten', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches dashboard activity recompute when a video session is created', async () => {
    const handler = handlerOf(onVideoSessionWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent(undefined, { status: 'review' }));

    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches dashboard activity recompute when a video session is updated', async () => {
    const handler = handlerOf(onVideoSessionWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ status: 'uploaded' }, { status: 'review' }));

    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });

  it('dispatches dashboard activity recompute when a video session is deleted', async () => {
    const handler = handlerOf(onVideoSessionWritten) as (event: unknown) => Promise<void>;

    await handler(makeEvent({ status: 'review' }, undefined));

    expect(mockRecomputeDashboardActivityAggregation).toHaveBeenCalledTimes(1);
  });
});
