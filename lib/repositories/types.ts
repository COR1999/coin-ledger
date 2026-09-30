/**
 * Repository interfaces — the data-access boundary. Engines and (later) route
 * handlers depend on these interfaces, never on a concrete store, so the
 * in-memory implementation can be swapped for a database without touching
 * business logic.
 */
import type {
  Business,
  PaymentProposal,
  Policies,
  Supplier,
  Transaction,
} from "@/lib/domain/types";

export interface BusinessRepository {
  get(): Promise<Business>;
  setBalanceCents(cents: number): Promise<Business>;
}

export interface SupplierRepository {
  list(): Promise<Supplier[]>;
  getById(id: string): Promise<Supplier | null>;
}

export interface TransactionRepository {
  list(): Promise<Transaction[]>;
  add(transaction: Transaction): Promise<Transaction>;
  /** Total money out (as a positive amount) recorded on a given ISO date. */
  spentOnDateCents(date: string): Promise<number>;
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
}

export interface PaymentProposalRepository {
  create(input: CreateProposalInput): Promise<PaymentProposal>;
  getById(id: string): Promise<PaymentProposal | null>;
  list(): Promise<PaymentProposal[]>;
  setStatus(
    id: string,
    status: PaymentProposal["status"],
  ): Promise<PaymentProposal>;
}

export interface Repositories {
  business: BusinessRepository;
  suppliers: SupplierRepository;
  transactions: TransactionRepository;
  policies: PolicyRepository;
  proposals: PaymentProposalRepository;
}
