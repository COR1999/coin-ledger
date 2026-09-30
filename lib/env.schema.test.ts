import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.schema";

describe("parseEnv", () => {
  it("defaults PAYMENT_PROVIDER to mock when unset", () => {
    const env = parseEnv({ ANTHROPIC_API_KEY: "sk-test" });
    expect(env.PAYMENT_PROVIDER).toBe("mock");
  });

  it("accepts a valid arc configuration", () => {
    const env = parseEnv({
      PAYMENT_PROVIDER: "arc",
      ARC_RPC_URL: "https://rpc.example.com/token",
      ANTHROPIC_API_KEY: "sk-test",
    });
    expect(env.PAYMENT_PROVIDER).toBe("arc");
    expect(env.ARC_RPC_URL).toBe("https://rpc.example.com/token");
  });

  it("rejects an unknown payment provider", () => {
    expect(() =>
      parseEnv({ PAYMENT_PROVIDER: "paypal", ANTHROPIC_API_KEY: "sk-test" }),
    ).toThrow(/Invalid environment variables/);
  });

  it("rejects a non-URL ARC_RPC_URL", () => {
    expect(() =>
      parseEnv({ ARC_RPC_URL: "not-a-url", ANTHROPIC_API_KEY: "sk-test" }),
    ).toThrow(/ARC_RPC_URL/);
  });

  it("rejects a missing ANTHROPIC_API_KEY", () => {
    expect(() => parseEnv({})).toThrow(/ANTHROPIC_API_KEY/);
  });
});
