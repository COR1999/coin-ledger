import { afterEach, describe, expect, it } from "vitest";

import { eur } from "@/lib/money";
import type { KvClient } from "./kv-snapshot";
import {
  DEMO_WORKSPACE_ID,
  getRepositories,
  registerWorkspace,
  setKvClientProvider,
  workspaceExists,
} from "./workspace-store";

describe("getRepositories", () => {
  it("lazily creates the demo workspace, seeded with Mario's Coffee", async () => {
    const repos = getRepositories(DEMO_WORKSPACE_ID);
    expect((await repos.business.get()).name).toBe("Mario's Coffee");
  });

  it("falls back to the demo workspace for an unknown non-demo id", async () => {
    const repos = getRepositories("ws-does-not-exist");
    expect((await repos.business.get()).name).toBe("Mario's Coffee");
  });

  it("defaults to the demo workspace when called with no argument", async () => {
    expect((await getRepositories().business.get()).name).toBe(
      "Mario's Coffee",
    );
  });
});

describe("registerWorkspace / workspaceExists", () => {
  it("makes a registered workspace's own data retrievable by id, isolated from the demo", async () => {
    const workspaceId = "ws-test-isolation";
    expect(await workspaceExists(workspaceId)).toBe(false);

    await registerWorkspace(workspaceId, {
      business: {
        id: workspaceId,
        name: "Riverside Bakery",
        currency: "EUR",
        currentBalanceCents: eur(5_000),
      },
      actors: [{ id: "owner", name: "Sam", role: "owner" }],
      suppliers: [],
      transactions: [],
      policies: await getRepositories(DEMO_WORKSPACE_ID).policies.get(),
      obligations: [],
    });

    expect(await workspaceExists(workspaceId)).toBe(true);
    const repos = getRepositories(workspaceId);
    expect((await repos.business.get()).name).toBe("Riverside Bakery");

    // The demo workspace is untouched by registering a second one.
    const demo = getRepositories(DEMO_WORKSPACE_ID);
    expect((await demo.business.get()).name).toBe("Mario's Coffee");
  });
});

describe("demo workspace always uses the in-memory backend", () => {
  afterEach(() => {
    // Module-level state — never leak a fake client into the next test.
    setKvClientProvider(() => null);
  });

  it("ignores a configured KV client for the demo id specifically", async () => {
    // Asserting the end data alone wouldn't be rigorous here: an earlier
    // test in this file may have already cached a demo entry in the shared
    // in-memory Map, so correct-looking data could mask a broken bypass.
    // The real proof is that the KV client is never even called.
    let kvWasCalled = false;
    const kv: KvClient = {
      get: async () => {
        kvWasCalled = true;
        return null;
      },
      set: async () => {
        kvWasCalled = true;
        return "OK";
      },
    };
    setKvClientProvider(() => kv);

    const business = await getRepositories(DEMO_WORKSPACE_ID).business.get();
    expect(kvWasCalled).toBe(false);
    expect(business.name).toBe("Mario's Coffee");
    expect(business.currentBalanceCents).toBe(eur(18_420));
  });

  it("still routes a non-demo workspace to the configured KV client", async () => {
    let sawGet = false;
    const kv: KvClient = {
      get: async () => {
        sawGet = true;
        return null;
      },
      set: async () => "OK",
    };
    setKvClientProvider(() => kv);

    await getRepositories("ws-kv-routing-check").business.get();
    expect(sawGet).toBe(true);
  });
});
