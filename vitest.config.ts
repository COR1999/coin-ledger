import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror tsconfig.json's path aliases.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "agent-policy-gate": fileURLToPath(
        new URL("./packages/agent-policy-gate/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // Unit tests must not hit the network.
    globals: false,
  },
});
