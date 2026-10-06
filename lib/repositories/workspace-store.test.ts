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

describe("demo workspace uses the configured KV client too, with a reset policy", () => {
  afterEach(() => {
    // Module-level state — never leak a fake client into the next test.
    setKvClientProvider(() => null);
  });

  it("routes the demo id to the configured KV client, not the in-memory fallback", async () => {
    let sawGet = false;
    const kv: KvClient = {
      get: async () => {
        sawGet = true;
        return null;
      },
      set: async () => "OK",
    };
    setKvClientProvider(() => kv);

    const business = await getRepositories(DEMO_WORKSPACE_ID).business.get();
    expect(sawGet).toBe(true);
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

describe("workspaceExists for the demo workspace", () => {
  afterEach(() => {
    setKvClientProvider(() => null);
  });

  it("reports true even when Redis has never stored the demo key", async () => {
    const kv: KvClient = {
      get: async () => null,
      set: async () => "OK",
    };
    setKvClientProvider(() => kv);

    expect(await workspaceExists(DEMO_WORKSPACE_ID)).toBe(true);
  });

  it("reports true with no KV client configured at all", async () => {
    expect(await workspaceExists(DEMO_WORKSPACE_ID)).toBe(true);
  });
});
