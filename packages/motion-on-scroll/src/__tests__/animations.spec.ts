import { JSDOM } from "jsdom";
import * as motion from "motion";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { play } from "../helpers/animations.js";
import { EASINGS } from "../helpers/constants.js";
import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import { clearAllElements, prepareElement, updatePreparedElements } from "../helpers/elements.js";
import type { ElementOptions } from "../helpers/types.js";

// Provide a DOM for motion to query
beforeAll(() => {
  const { window } = new JSDOM("<html><body></body></html>");
  (global as any).window = window;
  (global as any).document = window.document;
  (global as any).HTMLElement = window.HTMLElement;
});

// Shared helper to create opts objects quickly
function makeOpts(partial: Partial<ElementOptions> = {}): ElementOptions {
  return { ...DEFAULT_OPTIONS, keyframes: "fade", once: false, ...partial } as ElementOptions;
}

// Helper to prepare an element for testing and return MosElement
function prepareTestElement(
  div: HTMLElement,
  options: ElementOptions,
): import("../helpers/types.js").MosElement {
  div.setAttribute("data-mos", options.keyframes || "fade");
  document.body.appendChild(div);
  const mosElement = prepareElement(div, options);
  if (mosElement) {
    updatePreparedElements([mosElement]);
    return mosElement;
  }
  throw new Error("Failed to prepare test element");
}

describe("play/reset", () => {
  let div: HTMLElement;
  const animateSpy = motion.animate as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    div = document.createElement("div");

    // Clear any existing prepared elements
    clearAllElements();

    // reset call history before each test
    vi.clearAllMocks();
  });

  it("overrides translateY for fade-up with custom distance", () => {
    const DIST = 80;
    const options = makeOpts({ keyframes: "fade-up", distance: DIST });
    const mosElement = prepareTestElement(div, options);
    play(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    const [_, keyframes] = animateSpy.mock.calls[0];
    expect((keyframes as any).translateY).toEqual([DIST, 0]);
  });

  it("falls back to default easing when given invalid easing", () => {
    const options = makeOpts({ easing: "totally-invalid" as any });
    const mosElement = prepareTestElement(div, options);
    play(mosElement);

    const [_el, _kf, opts] = animateSpy.mock.calls[0];
    const expectedEase = EASINGS[DEFAULT_OPTIONS.easing];
    expect((opts as any).ease).toEqual(expectedEase);
  });

  it("does not trigger a second animation while one is already running", () => {
    const options = makeOpts();
    const mosElement = prepareTestElement(div, options);
    play(mosElement);
    play(mosElement);
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });

  it("stops controls automatically when opts.once is true", async () => {
    const options = makeOpts({ once: true });
    const mosElement = prepareTestElement(div, options);
    play(mosElement);
    const controls = animateSpy.mock.results[0].value;
    // flush microtasks so .finished promise resolves
    await Promise.resolve();
    expect(controls.stop).toHaveBeenCalled();
  });

  it("handles directional slide-left distance override", () => {
    const options = makeOpts({ keyframes: "slide-left", distance: 100 });
    const mosElement = prepareTestElement(div, options);
    play(mosElement);
    const [, keyframes] = animateSpy.mock.calls[0];
    expect((keyframes as any).translateX).toEqual([100, 0]);
  });

  /**
   * Parameterised tests for the many directional presets so we touch every
   * switch–case branch and improve line coverage. Each tuple defines:
   *  [preset, axis, directionSign]
   * where directionSign is +1 for positive distance and -1 for negative.
   */
  const DIR_PRESETS: Array<[ElementOptions["keyframes"], "X" | "Y", 1 | -1]> = [
    ["fade-down", "Y", -1],
    ["fade-left", "X", 1],
    ["fade-right", "X", -1],
    ["fade-up-right", "X", -1],
    ["fade-up-right", "Y", 1],
    ["fade-up-left", "X", 1],
    ["fade-up-left", "Y", 1],
    ["fade-down-right", "X", -1],
    ["fade-down-right", "Y", -1],
    ["fade-down-left", "X", 1],
    ["fade-down-left", "Y", -1],
    ["slide-up", "Y", 1],
    ["slide-down", "Y", -1],
    ["slide-right", "X", -1],
    ["zoom-in-up", "Y", 1],
    ["zoom-out-up", "Y", 1],
    ["zoom-in-down", "Y", -1],
    ["zoom-out-down", "Y", -1],
    ["zoom-in-left", "X", 1],
    ["zoom-out-left", "X", 1],
    ["zoom-in-right", "X", -1],
    ["zoom-out-right", "X", -1],
  ];

  const DIST = 42;
  DIR_PRESETS.forEach(([preset, axis, sign]) => {
    it(`${preset} applies translate${axis} with correct sign`, () => {
      const options = makeOpts({ keyframes: preset as any, distance: DIST });
      const mosElement = prepareTestElement(div, options);
      play(mosElement);
      const [, keyframes] = animateSpy.mock.calls[0];
      const prop = axis === "X" ? "translateX" : "translateY";
      expect((keyframes as any)[prop]).toEqual([DIST * sign, 0]);
      vi.clearAllMocks(); // prepare for next iteration
    });
  });
});
