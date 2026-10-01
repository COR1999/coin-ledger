/**
 * In-memory repository implementations seeded from lib/data/seed.ts. State is
 * deep-copied from the seed on construction so mutations never leak back into
 * the shared seed constants. Suitable for the hackathon; swap for a database
 * behind the same interfaces if needed.
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
import {
  seedActors,
  seedBusiness,
  seedObligations,
  seedPolicies,
  seedSuppliers,
  seedTransactions,
} from "@/lib/data/seed";
import type {
  ActorRepository,
  BusinessRepository,
  CreateProposalInput,
  ObligationRepository,
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

class InMemoryActorRepository implements ActorRepository {
  private actors: Actor[];
  constructor(actors: Actor[]) {
    this.actors = clone(actors);
  }
  async list(): Promise<Actor[]> {
    return clone(this.actors);
  }
}

class InMemoryObligationRepository implements ObligationRepository {
  private obligations: Obligation[];
  constructor(obligations: Obligation[]) {
    this.obligations = clone(obligations);
  }
  async list(): Promise<Obligation[]> {
    return clone(this.obligations);
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
  async spentOnDateByActorCents(
    date: string,
    actorId: string,
  ): Promise<number> {
    return this.transactions
      .filter(
        (t) =>
          t.date === date &&
          t.amountCents < 0 &&
          t.proposedByActorId === actorId,
      )
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
      status: input.status,
      createdAt: new Date().toISOString(),
      policyDecision: input.policyDecision,
      requiredApproverRole: input.requiredApproverRole,
      requiresConfirmation: input.requiresConfirmation,
      attempts: 0,
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
    return this.update(id, { status });
  }

  async update(
    id: string,
    fields: import("./types").ProposalUpdate,
  ): Promise<PaymentProposal> {
    const existing = this.proposals.get(id);
    if (!existing) {
      throw new Error(`Unknown proposal: ${id}`);
    }
    const updated = { ...existing, ...fields };
    this.proposals.set(id, updated);
    return clone(updated);
  }
}

export interface RepositorySeedData {
  business: Business;
  actors: Actor[];
  suppliers: Supplier[];
  transactions: Transaction[];
  policies: Policies;
  obligations: Obligation[];
}

/**
 * Builds a fresh set of in-memory repositories. With no argument, seeds
 * Mario's Coffee's demo data (unchanged default, used by every existing
 * caller and test). Onboarding (Phase 8) passes a visitor's own data instead
 * — same classes, same interfaces, just different starting state.
 */
export function createInMemoryRepositories(
  data: RepositorySeedData = {
    business: seedBusiness,
    actors: seedActors,
    suppliers: seedSuppliers,
    transactions: seedTransactions,
    policies: seedPolicies,
    obligations: seedObligations,
  },
): Repositories {
  return {
    business: new InMemoryBusinessRepository(data.business),
    actors: new InMemoryActorRepository(data.actors),
    suppliers: new InMemorySupplierRepository(data.suppliers),
    transactions: new InMemoryTransactionRepository(data.transactions),
    policies: new InMemoryPolicyRepository(data.policies),
    proposals: new InMemoryPaymentProposalRepository(),
    obligations: new InMemoryObligationRepository(data.obligations),
  };
}
