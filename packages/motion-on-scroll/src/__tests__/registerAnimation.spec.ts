import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock motion before importing modules under test
vi.mock("motion", () => {
  return {
    animate: vi.fn(() => ({
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      complete: vi.fn(),
      finished: Promise.resolve(),
      speed: 1,
      time: 0,
    })),
    spring: vi.fn((opts: any) => ({ ...opts, _spring: true })),
  };
});

import { JSDOM } from "jsdom";
import * as motion from "motion";

import { play, registerAnimation } from "../helpers/animations.js";
import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import { prepareElement, updatePreparedElements } from "../helpers/elements.js";
import type { ElementOptions } from "../helpers/types.js";

// Establish a DOM for motion and our utilities to interact with
beforeAll(() => {
  const { window } = new JSDOM("<html><body></body></html>");
  // @ts-expect-error attach globals for jsdom
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
});

function makeOpts(partial: Partial<ElementOptions> = {}): ElementOptions {
  // The test suite predates the rename from "preset" to "keyframes" – include both for safety.
  return {
    ...DEFAULT_OPTIONS,
    keyframes: "fade", // default
    once: false,
    ...(partial as any),
  } as ElementOptions;
}

describe("registerAnimation", () => {
  const animateSpy = motion.animate as unknown as ReturnType<typeof vi.fn>;
  let div: HTMLElement;

  beforeEach(() => {
    div = document.createElement("div");
    // Add required data-mos attribute for element preparation
    div.setAttribute("data-mos", "fade");
    document.body.appendChild(div);
    vi.clearAllMocks();
  });

  it("uses user-registered animation when key matches", () => {
    const NAME = "custom-test-animation";
    const KEYFRAMES = { opacity: [0, 1], scale: [0.4, 1] };

    // Create a spy for the custom animation factory
    const customFactory = vi.fn((el) => motion.animate(el, KEYFRAMES, { duration: 0.5 }));
    registerAnimation(NAME, customFactory);

    // Set the data-mos attribute to the custom animation name
    div.setAttribute("data-mos", NAME);

    // Prepare the element before calling play
    const options = makeOpts(); // Use default options
    const mosElement = prepareElement(div, options);
    if (mosElement) {
      updatePreparedElements([mosElement]);
      play(mosElement);

      // Verify the custom factory was called
      expect(customFactory).toHaveBeenCalledTimes(1);
      expect(customFactory).toHaveBeenCalledWith(div, expect.any(Object));

      // Verify motion.animate was called with custom keyframes
      expect(animateSpy).toHaveBeenCalledTimes(1);
      const [elArg, keyframesArg, optionsArg] = animateSpy.mock.calls[0];
      expect(elArg).toBe(div);
      expect(keyframesArg).toEqual(KEYFRAMES);
      expect(optionsArg.duration).toBe(0.5);
    } else {
      throw new Error("Failed to prepare element for test");
    }
  });

  it("falls back to built-in flow when no custom animation exists", () => {
    // Prepare the element before calling play
    const options = makeOpts({ keyframes: "unknown-preset" as any });
    const mosElement = prepareElement(div, options);
    if (mosElement) {
      updatePreparedElements([mosElement]);
      play(mosElement);
    } else {
      throw new Error("Failed to prepare element for test");
    }
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when registering with an empty name", () => {
    expect(() =>
      registerAnimation("" as any, () => ({ finished: Promise.resolve(), stop: () => {} }) as any),
    ).toThrow(/non-empty/i);
  });
});
