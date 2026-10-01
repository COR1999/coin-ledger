import { describe, expect, it } from "vitest";

import { DEMO_WORKSPACE_ID } from "@/lib/repositories/workspace-store";
import { isRealProviderAllowed } from "./workspace-provider-policy";

// provider.ts itself isn't unit-tested — see workspace-provider-policy.ts's
// comment. This covers the actual safety rule: no onboarding workspace may
// ever reach the real provider.
describe("isRealProviderAllowed", () => {
  it("allows the demo workspace", () => {
    expect(isRealProviderAllowed(DEMO_WORKSPACE_ID)).toBe(true);
  });

  it("disallows any other workspace, even a plausible-looking one", () => {
    expect(isRealProviderAllowed("ws-some-visitor")).toBe(false);
    expect(isRealProviderAllowed("demo2")).toBe(false);
    expect(isRealProviderAllowed("")).toBe(false);
  });
});
