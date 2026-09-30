/**
 * Mario's Coffee seed data (from docs/spec/product.md and docs/spec/policy.md).
 * Single source of truth for the in-memory repositories and for engine tests.
 * All monetary values are integer cents via eur().
 */
import type {
  Actor,
  Business,
  Obligation,
  Policies,
  Supplier,
  Transaction,
} from "@/lib/domain/types";
import { eur } from "@/lib/money";

/** Reference "today" for the seed. Obligations are dated relative to this. */
export const SEED_TODAY = "2026-09-30";

export const seedBusiness: Business = {
  id: "marios-coffee",
  name: "Mario's Coffee",
  currency: "EUR",
  currentBalanceCents: eur(18_420),
};

export const seedPolicies: Policies = {
  roles: {
    owner: {
      maxSinglePaymentCents: eur(3_000),
      dailyLimitCents: null,
      approvalLimitCents: eur(3_000),
      restrictedToApprovedSuppliers: false,
      canEditPolicies: true,
    },
    accountant: {
      maxSinglePaymentCents: eur(2_000),
      dailyLimitCents: eur(5_000),
      approvalLimitCents: eur(2_000),
      restrictedToApprovedSuppliers: false,
      canEditPolicies: false,
    },
    employee: {
      maxSinglePaymentCents: eur(100),
      dailyLimitCents: eur(300),
      approvalLimitCents: null,
      restrictedToApprovedSuppliers: true,
      canEditPolicies: false,
    },
  },
  businessDailyLimitCents: eur(10_000),
  minimumReserveCents: eur(3_000),
  confirmationThresholdCents: eur(1_000),
};

export const seedActors: Actor[] = [
  { id: "mario", name: "Mario", role: "owner" },
  { id: "aoife", name: "Aoife", role: "accountant" },
  { id: "liam", name: "Liam", role: "employee" },
];

export const seedSuppliers: Supplier[] = [
  {
    id: "abc-coffee",
    name: "ABC Coffee",
    category: "Coffee beans",
    employeeApproved: true,
    monthlyLimitCents: eur(8_000),
    spentThisMonthCents: eur(4_600),
    // Disposable testnet wallet, separate from the business wallet (see
    // docs/spec/payments.md § Supplier wallet). Circle-managed (wallet set
    // ee01db39-ea3a-55bf-b75b-cfdcd58a58dc) so the refund script
    // (scripts/refund-to-business.ts) can sweep test funds back.
    walletAddress: "0xe6f53dfee8ac633ce62ab09675fd0d43408e8acb",
  },
  {
    id: "local-veg",
    name: "Local Veg Supplier",
    category: "Produce",
    employeeApproved: true,
    monthlyLimitCents: eur(1_500),
    spentThisMonthCents: eur(300),
    walletAddress: "0xe6f53dfee8ac633ce62ab09675fd0d43408e8acb",
  },
  {
    id: "unknown-vendor",
    name: "Unknown Vendor Ltd",
    category: "Misc",
    employeeApproved: false,
    monthlyLimitCents: null,
    spentThisMonthCents: eur(0),
  },
];

/** Obligations due within 30 days of SEED_TODAY. Sum = €9,730. */
export const seedObligations: Obligation[] = [
  {
    id: "ob-software",
    name: "Software subscriptions",
    category: "Software",
    amountCents: eur(210),
    dueDate: "2026-10-05",
  },
  {
    id: "ob-utilities",
    name: "Utilities",
    category: "Utilities",
    amountCents: eur(420),
    dueDate: "2026-10-10",
  },
  {
    id: "ob-abc-invoice",
    name: "ABC Coffee invoice",
    category: "Supplier",
    amountCents: eur(1_600),
    dueDate: "2026-10-12",
  },
  {
    id: "ob-insurance",
    name: "Insurance premium",
    category: "Insurance",
    amountCents: eur(300),
    dueDate: "2026-10-15",
  },
  {
    id: "ob-veg-invoice",
    name: "Local Veg invoice",
    category: "Supplier",
    amountCents: eur(800),
    dueDate: "2026-10-20",
  },
  {
    id: "ob-wages",
    name: "Staff wages",
    category: "Wages",
    amountCents: eur(3_600),
    dueDate: "2026-10-28",
  },
  {
    id: "ob-rent",
    name: "Premises rent",
    category: "Rent",
    amountCents: eur(2_800),
    dueDate: "2026-10-01",
  },
];

/**
 * Representative recent transaction history. Illustrative rather than a full
 * 60-day ledger — the seed balance is authoritative and stored on the business;
 * the dashboard phase can expand this set.
 */
export const seedTransactions: Transaction[] = [
  {
    id: "tx-1",
    date: "2026-09-29",
    description: "Card takings",
    category: "Revenue",
    amountCents: eur(640),
  },
  {
    id: "tx-2",
    date: "2026-09-29",
    description: "ABC Coffee — beans",
    category: "Supplier",
    amountCents: -eur(1_200),
    supplierId: "abc-coffee",
  },
  {
    id: "tx-3",
    date: "2026-09-28",
    description: "Card takings",
    category: "Revenue",
    amountCents: eur(580),
  },
  {
    id: "tx-4",
    date: "2026-09-27",
    description: "Local Veg — produce",
    category: "Supplier",
    amountCents: -eur(300),
    supplierId: "local-veg",
  },
  {
    id: "tx-5",
    date: "2026-09-26",
    description: "Card takings",
    category: "Revenue",
    amountCents: eur(710),
  },
  {
    id: "tx-6",
    date: "2026-09-25",
    description: "Utilities direct debit",
    category: "Utilities",
    amountCents: -eur(410),
  },
  {
    id: "tx-7",
    date: "2026-09-24",
    description: "Card takings",
    category: "Revenue",
    amountCents: eur(690),
  },
  {
    id: "tx-8",
    date: "2026-09-20",
    description: "ABC Coffee — beans",
    category: "Supplier",
    amountCents: -eur(2_200),
    supplierId: "abc-coffee",
  },
  {
    id: "tx-9",
    date: "2026-09-15",
    description: "Staff wages",
    category: "Wages",
    amountCents: -eur(3_600),
  },
  {
    id: "tx-10",
    date: "2026-09-01",
    description: "Premises rent",
    category: "Rent",
    amountCents: -eur(2_800),
  },
];
