import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock motion.inView early so observer imports the stub
vi.mock("motion", () => ({ inView: vi.fn() }));

import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import { computeIOOptions, observeElement } from "../helpers/observer.js";
import type { AnchorPlacement } from "../helpers/types.js";

const { inView } = await import("motion");

/**
 * Unit tests for observer helpers (currently only computeIOOptions).
 * We purposely avoid wiring a DOM for IntersectionObserver – that behaviour
 * is covered indirectly through motion integration and separate E2E tests.
 */

describe("computeIOOptions", () => {
  const OFFSET = 120;

  const cases: Array<[AnchorPlacement | undefined, number]> = [
    ["top-top", 1],
    ["top-center", 0.75],
    ["top-bottom", 0],
    ["center-center", 0.5],
    ["bottom-center", 0.25],
    ["bottom-bottom", 0],
    [undefined, 0], // default when not provided
  ];

  cases.forEach(([placement, expectedAmount]) => {
    it(`maps ${placement ?? "<undefined>"} ➜ amount ${expectedAmount}`, () => {
      const { amount } = computeIOOptions(placement, OFFSET);
      expect(amount).toBe(expectedAmount);
    });
  });

  it("returns symmetric rootMargin from offset", () => {
    const { margin } = computeIOOptions("center-center", OFFSET);
    expect(margin).toBe(`${OFFSET}px 0px -${OFFSET}px 0px`);
  });
});

// -----------------------------------------------------------------------------
// Edge-case behaviour requiring DOM and mocked inView
// -----------------------------------------------------------------------------

describe("observer edge-cases", () => {
  beforeAll(() => {
    const { window } = new JSDOM("<html><body></body></html>");
    (global as any).window = window;
    (global as any).document = window.document;
    (global as any).HTMLElement = window.HTMLElement;
  });

  it("falls back to amount 0 for unknown anchorPlacement", () => {
    const res = computeIOOptions("non-existent" as AnchorPlacement, 80);
    expect(res.amount).toBe(0);
  });

  it("passes explicit data-mos-amount directly to inView", () => {
    const el = document.createElement("div");
    const opts = { ...DEFAULT_OPTIONS, preset: "fade", offset: 60, amount: 0.42 } as const;
    observeElement(el, opts as any);

    expect(inView).toHaveBeenCalledTimes(1);
    const options = (inView as any).mock.calls[0][2];
    expect(options.amount).toBeCloseTo(0.42);
    expect(options.margin).toBe(`${opts.offset}px 0px -${opts.offset}px 0px`);
  });

  it("does not call inView when opts.disable is true", () => {
    vi.clearAllMocks();
    const el = document.createElement("div");
    const opts = { ...DEFAULT_OPTIONS, preset: "fade", disable: true } as const;
    observeElement(el, opts as any);

    expect(inView).not.toHaveBeenCalled();
  });
});
