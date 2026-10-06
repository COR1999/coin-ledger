/**
 * Repository interfaces — the data-access boundary. Engines and (later) route
 * handlers depend on these interfaces, never on a concrete store, so the
 * in-memory implementation can be swapped for a database without touching
 * business logic.
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

export interface BusinessRepository {
  get(): Promise<Business>;
  /** Sets an absolute balance. Only for seeding/onboarding — never call this
   * from a code path that read the balance earlier in the same async flow,
   * since the write will silently discard any change made in between. Use
   * `adjustBalanceCents` for any balance change derived from an event. */
  setBalanceCents(cents: number): Promise<Business>;
  /** Atomically applies a signed delta to the current balance (negative for
   * money out). Safe under concurrent calls — unlike `setBalanceCents`, it
   * never depends on a balance value read before an intervening await. */
  adjustBalanceCents(deltaCents: number): Promise<Business>;
}

/** Actors are fixed per workspace (no sign-up flow), so read-only. */
export interface ActorRepository {
  list(): Promise<Actor[]>;
}

/**
 * Read-only reference data. The demo workspace serves Mario's Coffee's seed
 * bills; a workspace created via onboarding (Phase 8) has none, since the
 * wizard doesn't collect them — showing Mario's Coffee's bills on a
 * visitor's own dashboard would be actively misleading, not just unfinished.
 */
export interface ObligationRepository {
  list(): Promise<Obligation[]>;
}

export interface SupplierRepository {
  list(): Promise<Supplier[]>;
  getById(id: string): Promise<Supplier | null>;
  /** Partial update — currently only used to toggle `blocked`, deliberately
   * narrow rather than a general supplier-editing surface (no UI exists to
   * add/rename/remove suppliers post-onboarding; that's a bigger feature
   * than this build needs). */
  update(
    id: string,
    fields: Partial<Pick<Supplier, "blocked">>,
  ): Promise<Supplier>;
}

export interface TransactionRepository {
  list(): Promise<Transaction[]>;
  add(transaction: Transaction): Promise<Transaction>;
  /** Total money out (as a positive amount) recorded on a given ISO date. */
  spentOnDateCents(date: string): Promise<number>;
  /** Total money out by a specific actor on a given ISO date. */
  spentOnDateByActorCents(date: string, actorId: string): Promise<number>;
}

export interface PolicyRepository {
  get(): Promise<Policies>;
  set(policies: Policies): Promise<Policies>;
}

export interface CreateProposalInput {
  supplierId: string;
  amountCents: number;
  currency: "EUR";
  reason: string;
  proposedByActorId: string;
  policyDecision: import("@/lib/domain/types").Decision;
  requiredApproverRole?: Extract<
    import("@/lib/domain/types").Role,
    "owner" | "accountant"
  >;
  requiresConfirmation: boolean;
  status: import("@/lib/domain/types").ProposalStatus;
}

export type ProposalUpdate = Partial<
  Pick<
    PaymentProposal,
    | "status"
    | "approvedByActorId"
    | "confirmedByActorId"
    | "paymentId"
    | "txHash"
    | "failureReason"
    | "attempts"
  >
>;

export interface PaymentProposalRepository {
  create(input: CreateProposalInput): Promise<PaymentProposal>;
  getById(id: string): Promise<PaymentProposal | null>;
  list(): Promise<PaymentProposal[]>;
  setStatus(
    id: string,
    status: PaymentProposal["status"],
  ): Promise<PaymentProposal>;
  update(id: string, fields: ProposalUpdate): Promise<PaymentProposal>;
}

export interface Repositories {
  business: BusinessRepository;
  actors: ActorRepository;
  suppliers: SupplierRepository;
  transactions: TransactionRepository;
  policies: PolicyRepository;
  proposals: PaymentProposalRepository;
  obligations: ObligationRepository;
}
