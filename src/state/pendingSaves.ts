/**
 * Writes that are debounced or queued register a flush here, so that signing
 * out, deleting a profile or leaving the page can push them through first.
 */
const flushers = new Set<() => Promise<void>>();

export function registerFlush(flush: () => Promise<void>): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/** Run every pending flush; failures are logged, not thrown, so callers can proceed. */
export async function flushPendingSaves(): Promise<void> {
  await Promise.all(
    [...flushers].map((f) =>
      f().catch((err: unknown) => {
        console.error('Saving before leaving failed', err);
      }),
    ),
  );
}
