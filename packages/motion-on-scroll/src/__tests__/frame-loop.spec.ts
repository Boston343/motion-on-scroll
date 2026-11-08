// ===================================================================
// FRAME LOOP INTEGRATION (real Motion)
// ===================================================================
// Runs the real installed `motion` (the global mock is lifted here) to check
// that parking a paused animation really stops Motion's frame loop, and that
// the animation still plays to its end afterwards. Motion grabs
// requestAnimationFrame when it loads, so the stub goes in before the import.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { MosElement } from "../helpers/types.js";

vi.unmock("motion");

// ===================================================================
// FRAME QUEUE
// ===================================================================

let queue: FrameRequestCallback[] = [];

/** Frame callbacks waiting for the next frame */
const pendingFrames = (): number => queue.length;

/**
 * Runs `count` frames, letting real time pass between them so Motion's clock moves
 *
 * @param count - Number of frames to run
 */
async function runFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 16));
    const due = queue;
    queue = [];
    due.forEach((callback) => callback(performance.now()));
  }
}

// ===================================================================
// SETUP
// ===================================================================

let mos: typeof import("../helpers/animations.js");
let elements: typeof import("../helpers/elements.js");
let constants: typeof import("../helpers/constants.js");
let animate: typeof import("motion").animate;

beforeAll(async () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => queue.push(callback)),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  ({ animate } = await import("motion"));
  mos = await import("../helpers/animations.js");
  elements = await import("../helpers/elements.js");
  constants = await import("../helpers/constants.js");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  document.body.innerHTML = "";
  elements.clearAllElements();
  // The frame queue is deliberately kept: dropping a frame Motion has already
  // requested would leave its frame loop waiting for it forever
});

/**
 * Tracks an element that uses a custom animation built with the real animate()
 *
 * @param name - Animation name
 * @param keyframes - Keyframes passed to animate()
 */
function trackRealAnimation(name: string, keyframes: Record<string, unknown>): MosElement {
  mos.registerAnimation(name, (el) => animate(el, keyframes as never, { duration: 0.1 }));

  const element = document.createElement("div");
  element.setAttribute("data-mos", name);
  document.body.appendChild(element);

  const mosElement = elements.prepareElement(element, constants.DEFAULT_OPTIONS);
  if (!mosElement) throw new Error("Failed to prepare test element");
  elements.updatePreparedElements([mosElement]);
  return mosElement;
}

// ===================================================================
// TESTS
// ===================================================================

// jsdom has no WAAPI, so Motion runs everything here as a plain JSAnimation and
// these tests take the `driver.stop()` path. The compositor transform driver with
// `stopJS()` (Motion 14.10.1+) only exists in a real browser.
describe("parking paused animations with the real Motion", () => {
  it("stops the frame loop of a paused animation while it waits", async () => {
    const mosElement = trackRealAnimation("park-real-colour", {
      backgroundColor: ["rgb(255, 0, 0)", "rgb(0, 0, 255)"],
    });

    mos.setInitialState(mosElement);
    await runFrames(6);

    // Without parking, Motion keeps requesting a frame every frame here
    expect(pendingFrames()).toBe(0);
    expect(mosElement.controls?.state).toBe("paused");
    expect(mosElement.element.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it.each([
    ["colour", { backgroundColor: ["rgb(255, 0, 0)", "rgb(0, 0, 255)"] }, "backgroundColor"],
    ["transform", { x: [100, 0] }, "transform"],
  ] as const)("plays a parked %s animation to its last keyframe", async (kind, keyframes, prop) => {
    const mosElement = trackRealAnimation(`park-real-resume-${kind}`, keyframes);

    mos.setInitialState(mosElement);
    await runFrames(6);

    mos.play(mosElement);
    await runFrames(20);

    expect(mosElement.controls?.state).toBe("finished");
    const value = mosElement.element.style[prop];
    if (kind === "colour") expect(value).toBe("rgb(0, 0, 255)");
    else expect(value).toMatch(/^(none|translateX\(0(px)?\))$/);
  });
});
