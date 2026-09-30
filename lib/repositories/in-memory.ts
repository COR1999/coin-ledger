/**
 * In-memory repository implementations seeded from lib/data/seed.ts. State is
 * deep-copied from the seed on construction so mutations never leak back into
 * the shared seed constants. Suitable for the hackathon; swap for a database
 * behind the same interfaces if needed.
 */
import type {
  Business,
  PaymentProposal,
  Policies,
  Supplier,
  Transaction,
} from "@/lib/domain/types";
import {
  seedBusiness,
  seedObligations,
  seedPolicies,
  seedSuppliers,
  seedTransactions,
} from "@/lib/data/seed";
import type {
  BusinessRepository,
  CreateProposalInput,
  PaymentProposalRepository,
  PolicyRepository,
  Repositories,
  SupplierRepository,
  TransactionRepository,
} from "./types";

const clone = <T>(value: T): T => structuredClone(value);

class InMemoryBusinessRepository implements BusinessRepository {
  private business: Business;
  constructor(business: Business) {
    this.business = clone(business);
  }
  async get(): Promise<Business> {
    return clone(this.business);
  }
  async setBalanceCents(cents: number): Promise<Business> {
    this.business = { ...this.business, currentBalanceCents: cents };
    return clone(this.business);
  }
}

class InMemorySupplierRepository implements SupplierRepository {
  private suppliers: Supplier[];
  constructor(suppliers: Supplier[]) {
    this.suppliers = clone(suppliers);
  }
  async list(): Promise<Supplier[]> {
    return clone(this.suppliers);
  }
  async getById(id: string): Promise<Supplier | null> {
    const found = this.suppliers.find((s) => s.id === id);
    return found ? clone(found) : null;
  }
}

class InMemoryTransactionRepository implements TransactionRepository {
  private transactions: Transaction[];
  constructor(transactions: Transaction[]) {
    this.transactions = clone(transactions);
  }
  async list(): Promise<Transaction[]> {
    return clone(this.transactions);
  }
  async add(transaction: Transaction): Promise<Transaction> {
    this.transactions.push(clone(transaction));
    return clone(transaction);
  }
  async spentOnDateCents(date: string): Promise<number> {
    return this.transactions
      .filter((t) => t.date === date && t.amountCents < 0)
      .reduce((sum, t) => sum - t.amountCents, 0);
  }
}

class InMemoryPolicyRepository implements PolicyRepository {
  private policies: Policies;
  constructor(policies: Policies) {
    this.policies = clone(policies);
  }
  async get(): Promise<Policies> {
    return clone(this.policies);
  }
  async set(policies: Policies): Promise<Policies> {
    this.policies = clone(policies);
    return clone(this.policies);
  }
}

class InMemoryPaymentProposalRepository implements PaymentProposalRepository {
  private proposals = new Map<string, PaymentProposal>();
  private counter = 0;

  async create(input: CreateProposalInput): Promise<PaymentProposal> {
    this.counter += 1;
    const proposal: PaymentProposal = {
      id: `proposal-${this.counter}`,
      supplierId: input.supplierId,
      amountCents: input.amountCents,
      currency: input.currency,
      reason: input.reason,
      proposedByActorId: input.proposedByActorId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.proposals.set(proposal.id, proposal);
    return clone(proposal);
  }
  async getById(id: string): Promise<PaymentProposal | null> {
    const found = this.proposals.get(id);
    return found ? clone(found) : null;
  }
  async list(): Promise<PaymentProposal[]> {
    return [...this.proposals.values()].map(clone);
  }
  async setStatus(
    id: string,
    status: PaymentProposal["status"],
  ): Promise<PaymentProposal> {
    const existing = this.proposals.get(id);
    if (!existing) {
      throw new Error(`Unknown proposal: ${id}`);
    }
    const updated = { ...existing, status };
    this.proposals.set(id, updated);
    return clone(updated);
  }
}

/** Obligations are static reference data; exposed as a plain accessor. */
export function getSeedObligations() {
  return clone(seedObligations);
}

export function createInMemoryRepositories(): Repositories {
  return {
    business: new InMemoryBusinessRepository(seedBusiness),
    suppliers: new InMemorySupplierRepository(seedSuppliers),
    transactions: new InMemoryTransactionRepository(seedTransactions),
    policies: new InMemoryPolicyRepository(seedPolicies),
    proposals: new InMemoryPaymentProposalRepository(),
  };
}
