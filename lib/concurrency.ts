/**
 * Generic per-key in-process mutex: serializes calls sharing a key so their
 * bodies never interleave within one process — the pattern this app already
 * used once, privately, in lib/payments/execute.ts (keyed by proposal id,
 * guarding the provider-submission race). Extracted here because
 * lib/repositories/kv-snapshot.ts and lib/repositories/waitlist.ts need the
 * exact same shape (serializing load-mutate-save-back of a shared blob) and
 * a third copy-pasted implementation would be the actual duplication, not
 * reusing this one. execute.ts's own copy is left as-is — it's already
 * tested in place and touching working, safety-critical code for a cosmetic
 * dedupe isn't worth the risk.
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
