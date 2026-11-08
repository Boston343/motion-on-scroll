import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Real-browser specs run with vitest.browser.config.ts (pnpm test:browser)
    exclude: ["**/node_modules/**", "src/__tests__/browser/**"],
  },
});
