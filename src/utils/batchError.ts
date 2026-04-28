/**
 * Structured error thrown when a chunked Firestore writeBatch operation
 * partially commits before a chunk fails.
 *
 * The Firestore writeBatch limit is 500 (we chunk at 400). When a caller
 * writes more items than fit in a single batch, the service iterates and
 * commits each chunk in turn. If chunk N fails, chunks 0..N-1 are already
 * persisted — there is no rollback.
 *
 * Today the failure surfaces as a generic Error and the coach has no way
 * to know how many items landed. This error pins the partial state so:
 *   - UI can show "saved 400 of 600 — retry the remaining 200?"
 *   - logs and Sentry capture the exact split.
 *   - test assertions can verify the boundary.
 */
export class BatchPartialFailureError extends Error {
  readonly name = 'BatchPartialFailureError';

  /** Number of items successfully committed in chunks 0..failedChunkIndex-1. */
  readonly committedItemCount: number;

  /** Zero-based index of the chunk whose commit threw. */
  readonly failedChunkIndex: number;

  /** Items that were not written (failed chunk + any chunks after it). */
  readonly remainingItemCount: number;

  /** The original error from the failed batch.commit(). */
  readonly cause: unknown;

  constructor(opts: {
    committedItemCount: number;
    failedChunkIndex: number;
    remainingItemCount: number;
    cause: unknown;
  }) {
    super(
      `Batch write partially failed: committed ${opts.committedItemCount} item(s), then chunk ${opts.failedChunkIndex} failed (${opts.remainingItemCount} item(s) not written).`,
    );
    this.committedItemCount = opts.committedItemCount;
    this.failedChunkIndex = opts.failedChunkIndex;
    this.remainingItemCount = opts.remainingItemCount;
    this.cause = opts.cause;
  }
}
