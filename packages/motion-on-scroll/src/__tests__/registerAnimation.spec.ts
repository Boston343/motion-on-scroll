import * as motion from "motion";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { play, registerAnimation, setFinalState, setInitialState } from "../helpers/animations.js";
import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import { clearAllElements, prepareElement, updatePreparedElements } from "../helpers/elements.js";
import type { MosElement, MosOptions } from "../helpers/types.js";

// ===================================================================
// TEST HELPERS
// ===================================================================

// Reference to the mocked motion.animate fn created in vitest.setup.ts
const animateSpy = motion.animate as unknown as ReturnType<typeof vi.fn>;

function makeControls() {
  return { play: vi.fn(), pause: vi.fn(), complete: vi.fn(), cancel: vi.fn(), speed: 0 };
}

/** Creates a tracked element using the given data-mos name */
function track(
  name: string,
  attrs: Record<string, string> = {},
  globalOptions: Partial<MosOptions> = {},
): MosElement {
  const element = document.createElement("div");
  element.setAttribute("data-mos", name);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  document.body.appendChild(element);

  const mosElement = prepareElement(element, { ...DEFAULT_OPTIONS, ...globalOptions });
  if (!mosElement) throw new Error("Failed to prepare element for test");
  updatePreparedElements([mosElement]);
  return mosElement;
}

// ===================================================================
// REGISTER ANIMATION
// ===================================================================

describe("registerAnimation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    clearAllElements();
    vi.clearAllMocks();
  });

  it("uses the registered factory instead of motion's animate when the name matches", () => {
    const controls = makeControls();
    const factory = vi.fn(() => controls as any);
    registerAnimation("register-spec-basic", factory);
    const mosElement = track("register-spec-basic");

    play(mosElement);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(animateSpy).not.toHaveBeenCalled();
    expect(mosElement.controls).toBe(controls);
    expect(controls.speed).toBe(1);
    expect(controls.play).toHaveBeenCalledTimes(1);
    expect(mosElement.animated).toBe(true);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(true);
  });

  it("passes the element and its resolved options to the factory", () => {
    const factory = vi.fn((_el: HTMLElement, _opts: any) => makeControls() as any);
    registerAnimation("register-spec-options", factory);
    const mosElement = track(
      "register-spec-options",
      { "data-mos-duration": "750", "data-mos-delay": "50", "data-mos-id": "hero" },
      { easing: "linear" },
    );

    play(mosElement);

    const [el, opts] = factory.mock.calls[0];
    expect(el).toBe(mosElement.element);
    expect(opts).toBe(mosElement.options);
    // options are handed over as configured (no unit conversion)
    expect(opts).toMatchObject({
      keyframes: "register-spec-options",
      duration: 750,
      delay: 50,
      easing: "linear",
      timeUnits: "ms",
      id: "hero",
    });
  });

  it("lets the factory build its animation with motion's animate", () => {
    const KEYFRAMES = { opacity: [0, 1], scale: [0.4, 1] };
    registerAnimation("register-spec-motion", (el) =>
      motion.animate(el, KEYFRAMES, { duration: 0.5 }),
    );
    const mosElement = track("register-spec-motion");

    play(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(animateSpy).toHaveBeenCalledWith(mosElement.element, KEYFRAMES, { duration: 0.5 });
    expect(mosElement.controls).toBe(animateSpy.mock.results[0].value);
  });

  it("calls the factory only once per element", () => {
    const controls = makeControls();
    const factory = vi.fn(() => controls as any);
    registerAnimation("register-spec-once", factory);
    const mosElement = track("register-spec-once");

    setInitialState(mosElement);
    play(mosElement);
    play(mosElement);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(controls.pause).toHaveBeenCalledTimes(1);
    expect(controls.play).toHaveBeenCalledTimes(2);
  });

  it("uses the factory for setInitialState and setFinalState too", () => {
    const controls = makeControls();
    registerAnimation("register-spec-state", () => controls as any);

    const mosElement = track("register-spec-state");
    setFinalState(mosElement);

    expect(animateSpy).not.toHaveBeenCalled();
    expect(controls.complete).toHaveBeenCalledTimes(1);
    expect(mosElement.animated).toBe(true);
  });

  it("overwrites a previously registered animation with the same name", () => {
    const first = vi.fn(() => makeControls() as any);
    const second = vi.fn(() => makeControls() as any);
    registerAnimation("register-spec-overwrite", first);
    registerAnimation("register-spec-overwrite", second);

    play(track("register-spec-overwrite"));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("takes precedence over a built-in preset of the same name", () => {
    const factory = vi.fn(() => makeControls() as any);
    registerAnimation("zoom-out-left", factory);

    play(track("zoom-out-left"));

    expect(factory).toHaveBeenCalledTimes(1);
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("falls back to the built-in flow when no custom animation exists", () => {
    const mosElement = track("register-spec-unknown");
    play(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    // unknown names use the default fade preset
    expect(animateSpy).toHaveBeenCalledWith(
      mosElement.element,
      { opacity: [0, 1] },
      { duration: 0.4, ease: [0.25, 0.1, 0.25, 1], autoplay: false },
    );
  });

  it("leaves the delay to the factory: plays immediately and passes the raw delay", () => {
    vi.useFakeTimers();
    try {
      const controls = makeControls();
      const factory = vi.fn((_el: HTMLElement, _opts: any) => controls as any);
      registerAnimation("register-spec-delay", factory);
      const mosElement = track(
        "register-spec-delay",
        { "data-mos-delay": "0.5" },
        { timeUnits: "s", duration: 1 },
      );

      play(mosElement);

      expect(factory.mock.calls[0][1]).toMatchObject({ delay: 0.5, duration: 1, timeUnits: "s" });
      expect(controls.speed).toBe(1);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when registering with an empty or blank name", () => {
    const factory = () => makeControls() as any;
    expect(() => registerAnimation("", factory)).toThrow(/non-empty/i);
    expect(() => registerAnimation("   ", factory)).toThrow(/non-empty/i);
  });
});
