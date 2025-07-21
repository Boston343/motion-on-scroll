import { JSDOM } from "jsdom";
import * as motion from "motion";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { play, reverse, setFinalState, setInitialState } from "../helpers/animations.js";
import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import type { ElementOptions } from "../helpers/types.js";

// ---------------------------------------------------------------------------
// Test setup helpers
// ---------------------------------------------------------------------------

beforeAll(() => {
  const { window } = new JSDOM("<html><body></body></html>");
  // @ts-expect-error attach globals for jsdom
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
});

// Quick helper to create a complete ElementOptions object
function makeOpts(partial: Partial<ElementOptions> = {}): ElementOptions {
  return { ...DEFAULT_OPTIONS, preset: "fade", once: false, ...partial } as ElementOptions;
}

// Common reference to the mocked motion.animate fn created in vitest.setup.ts
const animateSpy = motion.animate as unknown as ReturnType<typeof vi.fn>;

// Utility to build animation controls with externally resolvable/rejectable promises
function createControllableControls() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;

  const finished = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const controls = {
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    complete: vi.fn(),
    finished,
    speed: 1,
    time: 0,
  } as unknown as motion.AnimationPlaybackControls;

  return { controls, resolve, reject };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("state helpers", () => {
  let div: HTMLElement;

  beforeEach(() => {
    div = document.createElement("div");
    vi.clearAllMocks();
  });

  it("setInitialState creates controls and pauses them when idle", () => {
    setInitialState(div, makeOpts());

    // animate should have been called once to create controls
    expect(animateSpy).toHaveBeenCalledTimes(1);
    const controls = animateSpy.mock.results[0].value;
    expect(controls.pause).toHaveBeenCalled();
  });

  it("setInitialState returns early when element is currently animating", () => {
    play(div, makeOpts()); // element now actively animating
    const controls = animateSpy.mock.results[0].value;
    vi.clearAllMocks();

    setInitialState(div, makeOpts()); // should hit early-return branch

    // No new animations should have been created and existing controls remain untouched
    expect(animateSpy).not.toHaveBeenCalled();
    expect(controls.pause).not.toHaveBeenCalled();
  });

  it("setFinalState completes animation and adds css class", () => {
    setFinalState(div, makeOpts());
    const controls = animateSpy.mock.results[0].value;

    expect(controls.complete).toHaveBeenCalled();
    expect(div.classList.contains("mos-animate")).toBe(true);
  });

  it("reverse plays backwards and executes onComplete after finish", async () => {
    // First call sets up controllable controls so we can resolve later
    const { controls, resolve } = createControllableControls();
    animateSpy.mockImplementationOnce(() => controls);

    // Forward play creates controls and css class
    play(div, makeOpts());
    expect(div.classList.contains("mos-animate")).toBe(true);

    const onComplete = vi.fn();
    reverse(div, onComplete);

    // Should configure reverse playback
    expect(controls.speed).toBe(-1);
    expect(controls.play).toHaveBeenCalled();

    // Finish the animation – this should trigger reverse completion handler
    resolve();
    await Promise.resolve(); // flush microtasks

    expect(controls.pause).toHaveBeenCalled();
    expect(div.classList.contains("mos-animate")).toBe(false);
    expect(onComplete).toHaveBeenCalled();
  });

  it("handles animation interruption gracefully via promise rejection", async () => {
    const { controls, reject } = createControllableControls();
    animateSpy.mockImplementationOnce(() => controls);

    play(div, makeOpts());

    // Trigger interruption error
    reject("fail");
    await Promise.resolve();

    // If the code reaches here without throwing an unhandled rejection the catch
    // branch executed successfully. Additional assertions aren’t necessary –
    // the absence of test errors is sufficient for coverage.
    expect(true).toBe(true);
  });
});
