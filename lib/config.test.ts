import { describe, expect, it } from "vitest";

import {
  arcExplorerTxUrl,
  DEMO_SCALE_LABEL,
  formatOnChainAmount,
  ONCHAIN_SCALE,
  toOnChainAmount,
} from "./config";
import { eur } from "@/lib/money";

describe("toOnChainAmount", () => {
  it("scales down by ONCHAIN_SCALE", () => {
    expect(ONCHAIN_SCALE).toBe(1000);
    expect(toOnChainAmount("2400.00")).toBe("2.4");
  });

  it("never does a silent 1:1 conversion", () => {
    expect(toOnChainAmount("1000.00")).toBe("1");
  });

  it("handles small amounts", () => {
    expect(toOnChainAmount("30.00")).toBe("0.03");
  });

  it("rejects a negative amount", () => {
    expect(() => toOnChainAmount("-5.00")).toThrow(/Invalid EUR amount/);
  });

  it("rejects a non-numeric amount", () => {
    expect(() => toOnChainAmount("abc")).toThrow(/Invalid EUR amount/);
  });
});

describe("formatOnChainAmount", () => {
  it("formats integer cents as an EURC display string", () => {
    expect(formatOnChainAmount(eur(2_400))).toBe("2.4 EURC");
    expect(formatOnChainAmount(eur(30))).toBe("0.03 EURC");
  });
});

describe("DEMO_SCALE_LABEL", () => {
  it("matches the label required by docs/spec/payments.md", () => {
    expect(DEMO_SCALE_LABEL).toBe("Testnet · 1:1,000 demo scale");
  });
});

describe("arcExplorerTxUrl", () => {
  it("builds a testnet explorer link for a tx hash", () => {
    expect(arcExplorerTxUrl("0xabc")).toBe(
      "https://testnet.arcscan.app/tx/0xabc",
    );
  });
});
