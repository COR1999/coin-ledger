import { describe, expect, it } from "vitest";

import { ONCHAIN_SCALE, toOnChainAmount } from "./config";

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
