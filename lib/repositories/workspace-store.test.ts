import { describe, expect, it } from "vitest";

import { eur } from "@/lib/money";
import { createInMemoryRepositories } from "./in-memory";
import {
  DEMO_WORKSPACE_ID,
  getRepositories,
  registerWorkspace,
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
    expect(workspaceExists(workspaceId)).toBe(false);

    registerWorkspace(
      workspaceId,
      createInMemoryRepositories({
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
      }),
    );

    expect(workspaceExists(workspaceId)).toBe(true);
    const repos = getRepositories(workspaceId);
    expect((await repos.business.get()).name).toBe("Riverside Bakery");

    // The demo workspace is untouched by registering a second one.
    const demo = getRepositories(DEMO_WORKSPACE_ID);
    expect((await demo.business.get()).name).toBe("Mario's Coffee");
  });
});
