import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Real-browser specs: the real `motion` (no global mock) in headless Chromium, which
// has the layout, WAAPI and compositor paths that jsdom lacks. Needs a Playwright
// Chromium: `pnpm exec playwright install chromium`.
export default defineConfig({
  test: {
    include: ["src/__tests__/browser/**/*.spec.ts"],
    setupFiles: ["./src/__tests__/browser/setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium", viewport: { width: 1200, height: 800 } }],
    },
  },
});
