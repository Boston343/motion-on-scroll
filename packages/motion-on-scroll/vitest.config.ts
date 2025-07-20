import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [
      // Ensure at least one JSDOM instance exists for specs that rely on window
      "./vitest.setup.ts",
    ],
  },
});
