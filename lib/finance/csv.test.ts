import { describe, expect, it } from "vitest";

import type { Transaction } from "@/lib/domain/types";
import { transactionsToCsv } from "./csv";

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    date: "2026-09-30",
    createdAt: "2026-09-30T10:00:00.000Z",
    description: "ABC Coffee — beans",
    category: "Supplier",
    amountCents: -1_200,
    ...overrides,
  };
}

describe("transactionsToCsv", () => {
  it("includes a header row and one row per transaction", () => {
    const csv = transactionsToCsv([tx()]);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "Date,Description,Category,Amount (EUR),Tx Hash,Explorer URL,Decision Hash",
    );
    expect(lines[1]).toBe("2026-09-30,ABC Coffee — beans,Supplier,-12.00,,,");
  });

  it("sorts newest first by createdAt, not array order", () => {
    const older = tx({
      id: "tx-old",
      date: "2026-09-29",
      createdAt: "2026-09-29T10:00:00.000Z",
    });
    const newer = tx({
      id: "tx-new",
      date: "2026-09-30",
      createdAt: "2026-09-30T10:00:00.000Z",
    });
    const csv = transactionsToCsv([older, newer]);
    expect(csv.indexOf("2026-09-30")).toBeLessThan(csv.indexOf("2026-09-29"));
  });

  it("quotes a description containing a comma", () => {
    const csv = transactionsToCsv([
      tx({ description: "ABC Coffee, invoice #42" }),
    ]);
    expect(csv).toContain('"ABC Coffee, invoice #42"');
  });

  it("escapes a description containing a double quote", () => {
    const csv = transactionsToCsv([tx({ description: 'The "good" supplier' })]);
    expect(csv).toContain('"The ""good"" supplier"');
  });

  it("includes the tx hash, explorer URL and decision hash when present", () => {
    const csv = transactionsToCsv([
      tx({
        txHash: "0xabc123",
        decisionHash: "deadbeef",
      }),
    ]);
    expect(csv).toContain("0xabc123");
    expect(csv).toContain("testnet.arcscan.app");
    expect(csv).toContain("deadbeef");
  });

  it("produces just the header row for no transactions", () => {
    const csv = transactionsToCsv([]);
    expect(csv.trim().split("\r\n")).toHaveLength(1);
  });
});
