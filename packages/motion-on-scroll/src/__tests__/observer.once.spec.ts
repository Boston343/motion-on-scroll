import { JSDOM } from "jsdom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock motion and animations before loading observer helper
vi.mock("motion", () => ({ inView: vi.fn() }));

vi.mock("../helpers/animations", () => {
  return {
    play: vi.fn(),
  };
});

import * as animations from "../helpers/animations.js";
import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import { observeElement } from "../index.js";

// Cast mocked exports with correct types
const { play: playSpy } = vi.mocked(animations);

beforeAll(() => {
  const { window } = new JSDOM("<html><body></body></html>");
  (global as any).window = window;
  (global as any).document = window.document;
  (global as any).HTMLElement = window.HTMLElement;
});

import { inView as rawInView } from "motion";
const inViewSpy = vi.mocked(rawInView);

beforeEach(() => {
  inViewSpy.mockClear();
  playSpy.mockClear();
});

describe("observeElement additional branches", () => {
  it("passes anchor element to inView and respects once=true cleanup", () => {
    // Build DOM elements
    const anchor = document.createElement("div");
    anchor.id = "anchor-el";
    const target = document.createElement("div");
    document.body.append(anchor, target);

    observeElement(target, {
      ...DEFAULT_OPTIONS,
      keyframes: "fade",
      anchor: "#anchor-el",
      once: true,
    } as any);

    expect(inViewSpy).toHaveBeenCalledTimes(1);
    const [firstEl, cb] = inViewSpy.mock.calls[0];
    expect(firstEl).toBe(anchor); // uses anchor selector
    expect(typeof cb).toBe("function");

    // Execute callback to simulate intersection
    // satisfies the declared signature
    const cleanup = cb(target, {} as unknown as IntersectionObserverEntry);
    expect(typeof cleanup).toBe("function");
    expect(playSpy).toHaveBeenCalledWith(target, expect.any(Object));

    // Even if we call returned cleanup, ensure no errors occur when once=true
    (cleanup as () => void)();
  });

  it("returns reset cleanup when once=false", () => {
    const el = document.createElement("div");
    observeElement(el, {
      ...DEFAULT_OPTIONS,
      keyframes: "fade",
      once: false,
    } as any);

    const cb = inViewSpy.mock.calls[0][1];
    // satisfies the declared signature
    const cleanup = cb(el, {} as unknown as IntersectionObserverEntry);
    expect(typeof cleanup).toBe("function");

    // invoke cleanup
    (cleanup as () => void)();
  });
});
