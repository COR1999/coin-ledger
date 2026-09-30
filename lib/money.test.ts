import { describe, expect, it } from "vitest";

import {
  eur,
  formatCents,
  formatEuros,
  formatEurosDisplay,
  parseAmountToCents,
} from "./money";

describe("parseAmountToCents", () => {
  it("parses whole and fractional amounts to integer cents", () => {
    expect(parseAmountToCents("2400.00")).toBe(240_000);
    expect(parseAmountToCents("30")).toBe(3_000);
    expect(parseAmountToCents("12.5")).toBe(1_250);
    expect(parseAmountToCents("0.99")).toBe(99);
  });

  it("rejects negatives, over-precise, and non-numeric input", () => {
    for (const bad of ["-5", "1.234", "abc", "", "1,000", "€5"]) {
      expect(() => parseAmountToCents(bad)).toThrow(/Invalid money amount/);
    }
  });
});

describe("formatCents / formatEuros", () => {
  it("formats cents as a two-decimal string", () => {
    expect(formatCents(240_000)).toBe("2400.00");
    expect(formatCents(99)).toBe("0.99");
    expect(formatCents(0)).toBe("0.00");
  });

  it("drops .00 for whole euros in display formatting", () => {
    expect(formatEuros(10_000)).toBe("€100");
    expect(formatEuros(10_050)).toBe("€100.50");
  });

  it("round-trips parse then format", () => {
    expect(formatCents(parseAmountToCents("1234.56"))).toBe("1234.56");
  });
});

describe("formatEurosDisplay", () => {
  it("groups thousands and shows cents only when non-zero", () => {
    expect(formatEurosDisplay(1_842_000)).toBe("€18,420");
    expect(formatEurosDisplay(569_050)).toBe("€5,690.50");
    expect(formatEurosDisplay(0)).toBe("€0");
    expect(formatEurosDisplay(99)).toBe("€0.99");
  });

  it("keeps the sign in front of the currency symbol", () => {
    expect(formatEurosDisplay(-280_000)).toBe("-€2,800");
  });
});

describe("eur", () => {
  it("builds integer cents without floats", () => {
    expect(eur(2_800)).toBe(280_000);
    expect(eur(12, 50)).toBe(1_250);
  });
});
