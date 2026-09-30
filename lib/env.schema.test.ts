import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.schema";

describe("parseEnv", () => {
  it("defaults PAYMENT_PROVIDER to mock when unset", () => {
    const env = parseEnv({ GOOGLE_API_KEY: "test-key" });
    expect(env.PAYMENT_PROVIDER).toBe("mock");
  });

  it("accepts a valid arc configuration", () => {
    const env = parseEnv({
      PAYMENT_PROVIDER: "arc",
      ARC_RPC_URL: "https://rpc.example.com/token",
      GOOGLE_API_KEY: "test-key",
      CIRCLE_API_KEY: "test-api-key",
      CIRCLE_ENTITY_SECRET: "test-entity-secret",
      CIRCLE_WALLET_ADDRESS: "0x0000000000000000000000000000000000dead",
    });
    expect(env.PAYMENT_PROVIDER).toBe("arc");
    expect(env.ARC_RPC_URL).toBe("https://rpc.example.com/token");
  });

  it("rejects an unknown payment provider", () => {
    expect(() =>
      parseEnv({ PAYMENT_PROVIDER: "paypal", GOOGLE_API_KEY: "test-key" }),
    ).toThrow(/Invalid environment variables/);
  });

  it("rejects a non-URL ARC_RPC_URL", () => {
    expect(() =>
      parseEnv({ ARC_RPC_URL: "not-a-url", GOOGLE_API_KEY: "test-key" }),
    ).toThrow(/ARC_RPC_URL/);
  });

  it("rejects a missing GOOGLE_API_KEY", () => {
    expect(() => parseEnv({})).toThrow(/GOOGLE_API_KEY/);
  });

  it("does not require Circle vars when PAYMENT_PROVIDER=mock", () => {
    expect(() =>
      parseEnv({ PAYMENT_PROVIDER: "mock", GOOGLE_API_KEY: "test-key" }),
    ).not.toThrow();
  });

  it("treats an empty placeholder value as unset, not invalid", () => {
    expect(() =>
      parseEnv({ ARC_PRIVATE_KEY: "", GOOGLE_API_KEY: "test-key" }),
    ).not.toThrow();
  });

  it("rejects PAYMENT_PROVIDER=arc without Circle credentials", () => {
    expect(() =>
      parseEnv({ PAYMENT_PROVIDER: "arc", GOOGLE_API_KEY: "test-key" }),
    ).toThrow(/CIRCLE_API_KEY/);
  });
});
