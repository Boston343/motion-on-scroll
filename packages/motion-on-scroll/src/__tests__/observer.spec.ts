import { describe, expect, it, vi } from "vitest";

// Mock the scroll handler since we're testing the wrapper
vi.mock("../helpers/scroll-handler.js", () => ({
  observeElement: vi.fn(),
  cleanupScrollHandler: vi.fn(),
  refreshElements: vi.fn(),
  updateScrollHandlerDelays: vi.fn(),
}));

import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import { observeElement } from "../index.js";

const scrollHandler = await import("../helpers/scroll-handler.js");
const { observeElement: observeElementWithScrollHandler } = vi.mocked(scrollHandler);

/**
 * Unit tests for observeElement wrapper function.
 * Tests the disable logic and delegation to scroll handler.
 */

describe("observeElement", () => {
  it("calls scroll handler when not disabled", () => {
    const el = document.createElement("div");
    const opts = { ...DEFAULT_OPTIONS, preset: "fade", disable: false } as const;

    observeElement(el, opts as any);

    expect(observeElementWithScrollHandler).toHaveBeenCalledTimes(1);
    expect(observeElementWithScrollHandler).toHaveBeenCalledWith(el, opts);
  });

  it("does not call scroll handler when disabled", () => {
    vi.clearAllMocks();
    const el = document.createElement("div");
    const opts = { ...DEFAULT_OPTIONS, preset: "fade", disable: true } as const;

    observeElement(el, opts as any);

    expect(observeElementWithScrollHandler).not.toHaveBeenCalled();
  });

  it("respects disable function that returns true", () => {
    vi.clearAllMocks();
    const el = document.createElement("div");
    const opts = { ...DEFAULT_OPTIONS, preset: "fade", disable: () => true } as const;

    observeElement(el, opts as any);

    expect(observeElementWithScrollHandler).not.toHaveBeenCalled();
  });

  it("respects disable function that returns false", () => {
    vi.clearAllMocks();
    const el = document.createElement("div");
    const opts = { ...DEFAULT_OPTIONS, preset: "fade", disable: () => false } as const;

    observeElement(el, opts as any);

    expect(observeElementWithScrollHandler).toHaveBeenCalledTimes(1);
    expect(observeElementWithScrollHandler).toHaveBeenCalledWith(el, opts);
  });
});
