/**
 * Redis-backed Repositories for one workspace — the fix for a confirmed live
 * bug: on Vercel, separate serverless instances don't share the in-memory
 * `globalThis` store (lib/repositories/workspace-store.ts), so a visitor's
 * onboarded workspace (or a policy edit, or the waitlist) can silently
 * disappear between requests (BUILD_LOG.md, 2026-10-03 — reproduced live,
 * reverted to the demo workspace within 4 seconds of creation).
 *
 * Deliberately NOT a from-scratch reimplementation of the business logic:
 * this module only knows how to load/save a JSON snapshot of a workspace's
 * entire state and hand it to the exact same `InMemory*Repository` classes
 * everything else already uses (lib/repositories/in-memory.ts) — one
 * implementation of the actual rules, not two to keep in sync.
 *
 * Persistence model: the whole workspace is one JSON blob under
 * `workspace:<id>`. Every repository method call loads that blob, rehydrates
 * it into fresh in-memory repositories, runs the one requested operation,
 * re-serializes whatever those repositories ended up holding, and writes it
 * back — read-modify-write, not a database transaction.
 *
 * Pure and framework-free by design (no "server-only", no @upstash/redis
 * import) so the read-modify-write logic is unit-testable against a fake
 * `KvClient` with no network call — see kv-client.ts for the real
 * Redis-backed client construction, which does carry "server-only".
 */
import type {
  Actor,
  Business,
  Obligation,
  PaymentProposal,
  Policies,
  Supplier,
  Transaction,
} from "@/lib/domain/types";
import { runExclusive } from "@/lib/concurrency";
import {
  createInMemoryRepositories,
  type RepositorySeedData,
} from "./in-memory";
import type {
  ActorRepository,
  BusinessRepository,
  CreateProposalInput,
  ObligationRepository,
  PaymentProposalRepository,
  Repositories,
  SupplierRepository,
  TransactionRepository,
  PolicyRepository,
  ProposalUpdate,
} from "./types";

export interface WorkspaceSnapshot {
  business: Business;
  actors: Actor[];
  suppliers: Supplier[];
  transactions: Transaction[];
  policies: Policies;
  obligations: Obligation[];
  proposals: PaymentProposal[];
  /**
   * ISO timestamp this snapshot was (re)seeded. Only ever read when the
   * owning `KvRepositories` was constructed with a `resetPolicy` — today
   * that's the demo workspace alone (see workspace-store.ts). Carried
   * forward unchanged on every ordinary mutation; only `toSnapshot`
   * (building a fresh seed) stamps a new value.
   */
  resetAt?: string;
}

/**
 * A workspace that's gone stale is reseeded automatically rather than left
 * to accumulate every visitor's test data forever. Deliberately opt-in per
 * workspace, not a default: an onboarded workspace (a real visitor's own
 * business) must never be silently wiped, so only the demo workspace is
 * ever constructed with one — see workspace-store.ts.
 */
export interface ResetPolicy {
  maxAgeMs: number;
}

/**
 * Minimal surface this module needs from a Redis-like client — narrow
 * enough to fake in tests with a plain in-memory Map. Deliberately untyped
 * values (not `string`): @upstash/redis's own `get`/`set` already
 * auto-serialize/deserialize JSON-safe values transparently (its documented,
 * supported usage pattern), so fighting that with a manual
 * JSON.stringify/parse layer on top would risk double-encoding. Every value
 * that ever flows through here is a WorkspaceSnapshot, itself built only
 * from this app's domain types (strings/numbers/arrays — no Date objects,
 * no class instances), so it round-trips through JSON cleanly either way.
 */
export interface KvClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<unknown>;
}

function toSnapshot(data: RepositorySeedData): WorkspaceSnapshot {
  return {
    business: data.business,
    actors: data.actors,
    suppliers: data.suppliers,
    transactions: data.transactions,
    policies: data.policies,
    obligations: data.obligations,
    proposals: data.proposals ?? [],
    resetAt: new Date().toISOString(),
  };
}

async function snapshotFromRepositories(
  repos: Repositories,
): Promise<WorkspaceSnapshot> {
  const [
    business,
    actors,
    suppliers,
    transactions,
    policies,
    obligations,
    proposals,
  ] = await Promise.all([
    repos.business.get(),
    repos.actors.list(),
    repos.suppliers.list(),
    repos.transactions.list(),
    repos.policies.get(),
    repos.obligations.list(),
    repos.proposals.list(),
  ]);
  return {
    business,
    actors,
    suppliers,
    transactions,
    policies,
    obligations,
    proposals,
  };
}

function snapshotKey(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

/**
 * Deliberately a different key from `snapshotKey`, not reused: `load()` can
 * be called from inside `withRepositories`, which already holds the
 * `runExclusive(snapshotKey(...))` lock for the whole read-modify-write —
 * acquiring the *same* key again from within that would deadlock against
 * itself (the pending lock can never see its own holder release). Using a
 * separate key still gives same-process protection against two concurrent
 * stale-detections double-reseeding, without that reentrancy risk.
 */
function resetLockKey(workspaceId: string): string {
  return `${snapshotKey(workspaceId)}:reset`;
}

/**
 * Redis-backed Repositories for one workspace.
 *
 * Known, deliberate limitation: `runExclusive` (lib/concurrency.ts) only
 * serializes operations against one workspace *within one process* — two
 * concurrent requests hitting two different serverless instances can still
 * race — last write wins at the whole-blob level. This fixes the confirmed,
 * demo-blocking bug (state vanishing entirely between requests) without
 * claiming to be a full distributed-transaction store; Circle's own
 * idempotency-key dedup remains the backstop against a genuine double
 * payment submission reaching the chain twice regardless of which process
 * handled which request (see lib/payments/idempotency.ts).
 */
export class KvRepositories implements Repositories {
  constructor(
    private readonly client: KvClient,
    private readonly workspaceId: string,
    /** Builds a starting snapshot for the rare case where this workspace's
     * Redis key is missing despite `registerWorkspace` having written it —
     * data loss on Redis's side, not an expected path for an onboarded
     * workspace. When `resetPolicy` is set (the demo workspace — see
     * workspace-store.ts), this same function is also the *expected* path
     * for every periodic reseed. */
    private readonly seedIfMissing: () => RepositorySeedData,
    /** Opt-in automatic reseed once the stored snapshot is older than
     * `maxAgeMs`. Omitted for every onboarded workspace — a real visitor's
     * data must never be silently wiped. */
    private readonly resetPolicy?: ResetPolicy,
  ) {}

  private async loadFresh(): Promise<WorkspaceSnapshot> {
    const raw = await this.client.get(snapshotKey(this.workspaceId));
    if (raw === null || raw === undefined) {
      return toSnapshot(this.seedIfMissing());
    }
    return raw as WorkspaceSnapshot;
  }

  private isStale(resetAt: string | undefined): boolean {
    if (!this.resetPolicy) return false;
    if (!resetAt) return true;
    const age = Date.now() - Date.parse(resetAt);
    return !Number.isFinite(age) || age > this.resetPolicy.maxAgeMs;
  }

  private async load(): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadFresh();
    if (!this.isStale(snapshot.resetAt)) {
      return snapshot;
    }

    // Stale: reseed and persist immediately, under a dedicated lock, so
    // every caller — read or write, this process or another — converges on
    // one reset rather than each stale read silently reseeding only for
    // itself (which would leave Redis never actually updated).
    return runExclusive(resetLockKey(this.workspaceId), async () => {
      const latest = await this.loadFresh();
      if (!this.isStale(latest.resetAt)) return latest;
      const fresh = toSnapshot(this.seedIfMissing());
      await this.save(fresh);
      return fresh;
    });
  }

  private async save(snapshot: WorkspaceSnapshot): Promise<void> {
    await this.client.set(snapshotKey(this.workspaceId), snapshot);
  }

  /** For mutations: load, run `op`, save whatever the in-memory repos ended
   * up holding, under the per-workspace mutex — the full read-modify-write
   * cycle a write needs to not lose a concurrent write within this process. */
  private withRepositories<T>(
    op: (repos: Repositories) => Promise<T>,
  ): Promise<T> {
    return runExclusive(snapshotKey(this.workspaceId), async () => {
      const snapshot = await this.load();
      const repos = createInMemoryRepositories(snapshot);
      const result = await op(repos);
      const next = await snapshotFromRepositories(repos);
      // resetAt is reset-policy metadata, not something the in-memory repos
      // know about — carry forward whatever `load()` already resolved it
      // to, rather than losing it (and so, accidentally, the staleness
      // clock) on every single write.
      await this.save({ ...next, resetAt: snapshot.resetAt });
      return result;
    });
  }

  /**
   * For pure reads: load and run `op`, with no write-back and no mutex.
   * Originally every method — read or write — went through
   * `withRepositories`, which meant a page doing nothing but reads (e.g. the
   * dashboard: 6+ calls, all reads) still paid for a Redis SET per call and
   * had every one of those calls serialized against each other by the
   * per-workspace mutex, despite none of them needing to coordinate with
   * anything. Measured live (2026-10-06): an onboarded workspace's dashboard
   * loaded in ~2.5s average vs. the in-memory demo's ~1.3s. Reads don't
   * mutate the snapshot and have no lost-update risk to guard against, so
   * they skip both the mutex and the save — only a genuine read-modify-write
   * (a mutation) needs `withRepositories` above.
   */
  private async withReadOnlyRepositories<T>(
    op: (repos: Repositories) => Promise<T>,
  ): Promise<T> {
    const snapshot = await this.load();
    const repos = createInMemoryRepositories(snapshot);
    return op(repos);
  }

  business: BusinessRepository = {
    get: () => this.withReadOnlyRepositories((r) => r.business.get()),
    setBalanceCents: (cents) =>
      this.withRepositories((r) => r.business.setBalanceCents(cents)),
    adjustBalanceCents: (delta) =>
      this.withRepositories((r) => r.business.adjustBalanceCents(delta)),
  };

  actors: ActorRepository = {
    list: () => this.withReadOnlyRepositories((r) => r.actors.list()),
  };

  suppliers: SupplierRepository = {
    list: () => this.withReadOnlyRepositories((r) => r.suppliers.list()),
    getById: (id) =>
      this.withReadOnlyRepositories((r) => r.suppliers.getById(id)),
    update: (id, fields) =>
      this.withRepositories((r) => r.suppliers.update(id, fields)),
  };

  transactions: TransactionRepository = {
    list: () => this.withReadOnlyRepositories((r) => r.transactions.list()),
    add: (transaction) =>
      this.withRepositories((r) => r.transactions.add(transaction)),
    spentOnDateCents: (date) =>
      this.withReadOnlyRepositories((r) =>
        r.transactions.spentOnDateCents(date),
      ),
    spentOnDateByActorCents: (date, actorId) =>
      this.withReadOnlyRepositories((r) =>
        r.transactions.spentOnDateByActorCents(date, actorId),
      ),
  };

  policies: PolicyRepository = {
    get: () => this.withReadOnlyRepositories((r) => r.policies.get()),
    set: (policies) => this.withRepositories((r) => r.policies.set(policies)),
  };

  proposals: PaymentProposalRepository = {
    create: (input: CreateProposalInput) =>
      this.withRepositories((r) => r.proposals.create(input)),
    getById: (id) =>
      this.withReadOnlyRepositories((r) => r.proposals.getById(id)),
    list: () => this.withReadOnlyRepositories((r) => r.proposals.list()),
    setStatus: (id, status) =>
      this.withRepositories((r) => r.proposals.setStatus(id, status)),
    update: (id, fields: ProposalUpdate) =>
      this.withRepositories((r) => r.proposals.update(id, fields)),
  };

  obligations: ObligationRepository = {
    list: () => this.withReadOnlyRepositories((r) => r.obligations.list()),
  };
}

/** True if a workspace already has a persisted snapshot in Redis. */
export async function kvWorkspaceExists(
  client: KvClient,
  workspaceId: string,
): Promise<boolean> {
  const raw = await client.get(snapshotKey(workspaceId));
  return raw !== null && raw !== undefined;
}

/** Writes a workspace's starting snapshot (onboarding's registration step). */
export async function registerKvWorkspace(
  client: KvClient,
  workspaceId: string,
  data: RepositorySeedData,
): Promise<void> {
  await client.set(snapshotKey(workspaceId), toSnapshot(data));
}
