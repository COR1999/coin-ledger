/**
 * Generic per-key in-process mutex: serializes calls sharing a key so their
 * bodies never interleave within one process. Used by payment execution,
 * the Redis-backed workspace store and the waitlist. Only covers one
 * process; pair it with lib/distributed-lock.ts where serverless instances
 * share state.
 */
const locks = new Map<string, Promise<unknown>>();

export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  tail.finally(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}
