import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agentos/config": new URL("./packages/config/src/index.ts", import.meta.url).pathname,
      "@agentos/connectors": new URL("./packages/connectors/src/index.ts", import.meta.url)
        .pathname,
      "@agentos/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@agentos/memory": new URL("./packages/memory/src/index.ts", import.meta.url).pathname,
      "@agentos/sdk": new URL("./packages/sdk/src/index.ts", import.meta.url).pathname,
      "@agentos/tools": new URL("./packages/tools/src/index.ts", import.meta.url).pathname,
      "@agentos/types": new URL("./packages/types/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
