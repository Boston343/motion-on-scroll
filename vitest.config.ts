import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["packages/**/src/__tests__/**/*.spec.ts"],
    },
  },
]);
