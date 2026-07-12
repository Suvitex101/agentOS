import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agentosdev/config": new URL("./packages/config/src/index.ts", import.meta.url).pathname,
      "@agentosdev/connectors": new URL("./packages/connectors/src/index.ts", import.meta.url)
        .pathname,
      "@agentosdev/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@agentosdev/memory": new URL("./packages/memory/src/index.ts", import.meta.url).pathname,
      "@agentosdev/sdk": new URL("./packages/sdk/src/index.ts", import.meta.url).pathname,
      "@agentosdev/tools": new URL("./packages/tools/src/index.ts", import.meta.url).pathname,
      "@agentosdev/types": new URL("./packages/types/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
