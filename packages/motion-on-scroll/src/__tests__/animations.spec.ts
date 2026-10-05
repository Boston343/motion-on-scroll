import * as motion from "motion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelPendingShow,
  play,
  registerAnimation,
  reverse,
  setFinalState,
  setInitialState,
} from "../helpers/animations.js";
import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import {
  clearAllElements,
  disposeControls,
  prepareElement,
  updatePreparedElements,
} from "../helpers/elements.js";
import { registerKeyframes } from "../helpers/keyframes.js";
import type { MosElement, MosOptions } from "../helpers/types.js";

// ===================================================================
// TEST HELPERS
// ===================================================================

// Reference to the mocked motion.animate fn created in vitest.setup.ts
const animateSpy = motion.animate as unknown as ReturnType<typeof vi.fn>;

const CSS_EASE = [0.25, 0.1, 0.25, 1];

/**
 * Creates an element with the given data-mos attributes, prepares it with the
 * given global options and registers it as the only tracked element
 */
function track(
  attrs: Record<string, string> = {},
  globalOptions: Partial<MosOptions> = {},
): MosElement {
  const element = document.createElement("div");
  element.setAttribute("data-mos", "fade");
  Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
  document.body.appendChild(element);

  const mosElement = prepareElement(element, { ...DEFAULT_OPTIONS, ...globalOptions });
  if (!mosElement) throw new Error("Failed to prepare test element");
  updatePreparedElements([mosElement]);
  return mosElement;
}

/** Controls returned by the n-th call to the mocked animate() */
function controlsOf(callIndex = 0): any {
  return animateSpy.mock.results[callIndex].value;
}

/** Arguments of the n-th call to the mocked animate() */
function animateArgs(callIndex = 0): [HTMLElement, any, any] {
  return animateSpy.mock.calls[callIndex] as [HTMLElement, any, any];
}

type RecordedEvent = { type: string; detail: unknown };
const EVENT_TYPES = ["mos:in", "mos:out", "mos:in:hero", "mos:out:hero"];
let events: RecordedEvent[] = [];
const recordEvent = (e: Event) => {
  events.push({ type: e.type, detail: (e as CustomEvent).detail });
};

beforeEach(() => {
  document.body.innerHTML = "";
  clearAllElements();
  vi.clearAllMocks();

  events = [];
  EVENT_TYPES.forEach((type) => document.addEventListener(type, recordEvent));
});

afterEach(() => {
  EVENT_TYPES.forEach((type) => document.removeEventListener(type, recordEvent));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ===================================================================
// PLAY
// ===================================================================

describe("play", () => {
  it("creates controls, plays forward and marks the element as animated", () => {
    const mosElement = track();
    play(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    const controls = controlsOf();
    expect(mosElement.controls).toBe(controls);
    expect(controls.speed).toBe(1);
    expect(controls.play).toHaveBeenCalledTimes(1);
    expect(mosElement.animated).toBe(true);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(true);
  });

  it("passes the element and the preset keyframes to motion's animate", () => {
    const mosElement = track({ "data-mos": "fade-up" });
    play(mosElement);

    const [el, keyframes] = animateArgs();
    expect(el).toBe(mosElement.element);
    expect(keyframes).toEqual({ opacity: [0, 1], translateY: [100, 0] });
  });

  it("reuses the existing controls instead of creating a second animation", () => {
    const mosElement = track();
    play(mosElement);
    play(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(controlsOf().play).toHaveBeenCalledTimes(2);
    expect(mosElement.controls).toBe(controlsOf());
  });

  it("resets a reversed playback speed back to forward", () => {
    const mosElement = track();
    play(mosElement);
    controlsOf().speed = -1;

    play(mosElement);

    expect(controlsOf().speed).toBe(1);
  });

  it("does not stop the controls for once elements", async () => {
    const mosElement = track({ "data-mos-once": "true" });
    play(mosElement);

    // flush microtasks so a (removed) completion handler would have run
    await Promise.resolve();
    await Promise.resolve();

    expect(controlsOf().stop).not.toHaveBeenCalled();
    expect(mosElement.controls).toBe(controlsOf());
    expect(mosElement.animated).toBe(true);
  });

  it("does nothing for an element that is not tracked", () => {
    const mosElement = track();
    clearAllElements();

    play(mosElement);

    expect(animateSpy).not.toHaveBeenCalled();
    expect(mosElement.controls).toBeUndefined();
    expect(mosElement.animated).toBe(false);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(false);
    expect(events).toEqual([]);
  });
});

// ===================================================================
// REVERSE
// ===================================================================

describe("reverse", () => {
  it("is a no-op when the element has no controls", () => {
    const mosElement = track();
    mosElement.animated = true;
    mosElement.element.classList.add("mos-animate");

    reverse(mosElement);

    expect(animateSpy).not.toHaveBeenCalled();
    expect(mosElement.controls).toBeUndefined();
    expect(mosElement.animated).toBe(true);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(true);
    expect(events).toEqual([]);
  });

  it("plays backwards and hides the element immediately", () => {
    const mosElement = track();
    play(mosElement);
    const controls = controlsOf();

    reverse(mosElement);

    // state changes synchronously, without waiting for the animation to finish
    expect(controls.speed).toBe(-1);
    expect(controls.play).toHaveBeenCalledTimes(2);
    expect(mosElement.animated).toBe(false);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(false);
    // the animation itself is kept so it can be played again
    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(mosElement.controls).toBe(controls);
    expect(controls.stop).not.toHaveBeenCalled();
    expect(controls.pause).not.toHaveBeenCalled();
  });

  it("stays hidden after the reversed animation finishes", async () => {
    const mosElement = track();
    play(mosElement);
    reverse(mosElement);

    await controlsOf().finished;
    await Promise.resolve();

    expect(mosElement.animated).toBe(false);
    expect(mosElement.controls).toBe(controlsOf());
    expect(controlsOf().speed).toBe(-1);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(false);
  });

  it("reverses an element that was put in its final state", () => {
    const mosElement = track();
    setFinalState(mosElement);

    reverse(mosElement);

    expect(controlsOf().speed).toBe(-1);
    expect(controlsOf().play).toHaveBeenCalledTimes(1);
    expect(mosElement.animated).toBe(false);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(false);
  });
});

// ===================================================================
// PLAY / REVERSE SEQUENCE
// ===================================================================

describe("play -> reverse -> play", () => {
  it("turns the same animation around each time", () => {
    const mosElement = track({ "data-mos-id": "hero" });
    const { element } = mosElement;

    play(mosElement);
    const controls = controlsOf();
    expect(controls.speed).toBe(1);
    expect(mosElement.animated).toBe(true);
    expect(element.classList.contains("mos-animate")).toBe(true);

    reverse(mosElement);
    expect(controls.speed).toBe(-1);
    expect(mosElement.animated).toBe(false);
    expect(element.classList.contains("mos-animate")).toBe(false);

    play(mosElement);
    expect(controls.speed).toBe(1);
    expect(mosElement.animated).toBe(true);
    expect(element.classList.contains("mos-animate")).toBe(true);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(mosElement.controls).toBe(controls);
    expect(controls.play).toHaveBeenCalledTimes(3);
    expect(controls.stop).not.toHaveBeenCalled();
    expect(events.map((e) => e.type)).toEqual([
      "mos:in",
      "mos:in:hero",
      "mos:out",
      "mos:out:hero",
      "mos:in",
      "mos:in:hero",
    ]);
  });
});

// ===================================================================
// INITIAL / FINAL STATE
// ===================================================================

describe("setInitialState", () => {
  it("creates paused controls without showing the element", () => {
    const mosElement = track();
    setInitialState(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    const controls = controlsOf();
    expect(mosElement.controls).toBe(controls);
    expect(controls.pause).toHaveBeenCalledTimes(1);
    expect(controls.play).not.toHaveBeenCalled();
    expect(controls.complete).not.toHaveBeenCalled();
    expect(mosElement.animated).toBe(false);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(false);
    expect(events).toEqual([]);
  });

  it("does nothing on later calls once controls exist", () => {
    const mosElement = track();
    setInitialState(mosElement);
    setInitialState(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(controlsOf().pause).toHaveBeenCalledTimes(1);
  });

  it("leaves an element that is animated in untouched", () => {
    const mosElement = track();
    play(mosElement);

    setInitialState(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(controlsOf().pause).not.toHaveBeenCalled();
    expect(controlsOf().speed).toBe(1);
    expect(mosElement.animated).toBe(true);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(true);
  });

  it("does not pause an element that is animating out", () => {
    const mosElement = track();
    play(mosElement);
    reverse(mosElement);

    setInitialState(mosElement);

    expect(controlsOf().pause).not.toHaveBeenCalled();
    expect(controlsOf().speed).toBe(-1);
    expect(mosElement.animated).toBe(false);
  });

  it("does nothing for an element that is not tracked", () => {
    const mosElement = track();
    clearAllElements();

    setInitialState(mosElement);

    expect(animateSpy).not.toHaveBeenCalled();
    expect(mosElement.controls).toBeUndefined();
  });
});

describe("setInitialState - parking motion's idle frame loop", () => {
  let frames: FrameRequestCallback[] = [];

  /** Runs the callbacks queued so far (callbacks queued meanwhile wait for the next frame) */
  function nextFrame(): void {
    const due = frames;
    frames = [];
    due.forEach((callback) => callback(0));
  }

  /** Registers a factory returning the given controls and tracks an element using it */
  function trackWithControls(name: string, controls: unknown): MosElement {
    registerAnimation(name, () => controls as any);
    return track({ "data-mos": name });
  }

  beforeEach(() => {
    frames = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
    );
  });

  it("stops the driver of every paused animation after two frames, not before", () => {
    const first = { state: "paused", stopDriver: vi.fn() };
    const second = { state: "paused", stopDriver: vi.fn() };
    const controls = {
      pause: vi.fn(),
      play: vi.fn(),
      animations: [{ animation: first }, { animation: second }],
    };

    setInitialState(trackWithControls("park-spec-group", controls));

    expect(controls.pause).toHaveBeenCalledTimes(1);
    expect(first.stopDriver).not.toHaveBeenCalled();

    nextFrame();
    expect(first.stopDriver).not.toHaveBeenCalled();
    expect(second.stopDriver).not.toHaveBeenCalled();

    nextFrame();
    expect(first.stopDriver).toHaveBeenCalledTimes(1);
    expect(second.stopDriver).toHaveBeenCalledTimes(1);

    // and it is not a recurring loop
    expect(frames).toHaveLength(0);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("leaves an animation alone that is running by the time the frames have passed", () => {
    const running = { state: "running", stopDriver: vi.fn() };
    const paused = { state: "paused", stopDriver: vi.fn() };
    const controls = {
      pause: vi.fn(),
      animations: [{ animation: running }, { animation: paused }],
    };

    setInitialState(trackWithControls("park-spec-running", controls));
    nextFrame();
    nextFrame();

    expect(running.stopDriver).not.toHaveBeenCalled();
    expect(paused.stopDriver).toHaveBeenCalledTimes(1);
  });

  it("checks the state when the second frame runs, not when the element is set up", () => {
    const animation = { state: "paused", stopDriver: vi.fn() };
    const controls = { pause: vi.fn(), play: vi.fn(), speed: 1, animations: [{ animation }] };
    const mosElement = trackWithControls("park-spec-late", controls);

    setInitialState(mosElement);
    nextFrame();
    // the element scrolls into view between the two frames
    play(mosElement);
    animation.state = "running";
    nextFrame();

    expect(animation.stopDriver).not.toHaveBeenCalled();
  });

  it("uses a group entry itself when it does not wrap an inner animation", () => {
    const entry = { state: "paused", stopDriver: vi.fn() };
    const controls = { pause: vi.fn(), animations: [entry] };

    setInitialState(trackWithControls("park-spec-unwrapped", controls));
    nextFrame();
    nextFrame();

    expect(entry.stopDriver).toHaveBeenCalledTimes(1);
  });

  it("falls back to the controls object when there is no animations array", () => {
    const controls = { pause: vi.fn(), state: "paused", stopDriver: vi.fn() };

    setInitialState(trackWithControls("park-spec-single", controls));
    nextFrame();
    expect(controls.stopDriver).not.toHaveBeenCalled();
    nextFrame();

    expect(controls.stopDriver).toHaveBeenCalledTimes(1);
  });

  it("does not stop controls without an animations array that are not paused", () => {
    const controls = { pause: vi.fn(), state: "running", stopDriver: vi.fn() };

    setInitialState(trackWithControls("park-spec-single-running", controls));
    nextFrame();
    nextFrame();

    expect(controls.stopDriver).not.toHaveBeenCalled();
  });

  it("does not throw when stopDriver is missing", () => {
    const controls = {
      pause: vi.fn(),
      animations: [{ animation: { state: "paused" } }, { state: "paused" }],
    };

    setInitialState(trackWithControls("park-spec-no-driver", controls));

    expect(() => {
      nextFrame();
      nextFrame();
    }).not.toThrow();
  });

  it("does not throw for controls with neither animations nor stopDriver (the mocked motion controls)", () => {
    const mosElement = track();
    setInitialState(mosElement);

    expect(() => {
      nextFrame();
      nextFrame();
    }).not.toThrow();
    expect(controlsOf().pause).toHaveBeenCalledTimes(1);
  });

  it("does not throw for an empty animations array", () => {
    const controls = { pause: vi.fn(), animations: [], stopDriver: vi.fn(), state: "paused" };

    setInitialState(trackWithControls("park-spec-empty", controls));
    nextFrame();
    nextFrame();

    // the array is used as given, so the controls object itself is not touched
    expect(controls.stopDriver).not.toHaveBeenCalled();
  });

  it("requests no frames when the controls already exist", () => {
    const mosElement = track();
    play(mosElement);

    setInitialState(mosElement);

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("requests no frames for play or setFinalState", () => {
    play(track());
    setFinalState(track());

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});

describe("setFinalState", () => {
  it("completes the animation and marks the element as animated", () => {
    const mosElement = track();
    setFinalState(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    const controls = controlsOf();
    expect(mosElement.controls).toBe(controls);
    expect(controls.complete).toHaveBeenCalledTimes(1);
    expect(controls.play).not.toHaveBeenCalled();
    expect(mosElement.animated).toBe(true);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(true);
  });

  it("announces a newly shown element with mos:in, like AOS does for elements above the fold", () => {
    const mosElement = track({ "data-mos-id": "hero" });
    setFinalState(mosElement);

    expect(events.map((event) => event.type)).toEqual(["mos:in", "mos:in:hero"]);
  });

  it("does not dispatch any event for an element that was already shown", () => {
    const mosElement = track({ "data-mos-id": "hero" });
    mosElement.animated = true;
    setFinalState(mosElement);

    expect(events).toEqual([]);
  });

  it("sets the forward speed before completing, so a reversed animation ends on its shown state", () => {
    const mosElement = track();
    play(mosElement);
    reverse(mosElement);
    const controls = controlsOf();
    expect(controls.speed).toBe(-1);

    let speedAtComplete: number | undefined;
    controls.complete.mockImplementation(() => {
      speedAtComplete = controls.speed;
    });

    setFinalState(mosElement);

    expect(controls.complete).toHaveBeenCalledTimes(1);
    expect(speedAtComplete).toBe(1);
    expect(controls.speed).toBe(1);
    expect(mosElement.animated).toBe(true);
  });

  it("reuses controls created by setInitialState", () => {
    const mosElement = track();
    setInitialState(mosElement);
    setFinalState(mosElement);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    expect(controlsOf().complete).toHaveBeenCalledTimes(1);
    expect(mosElement.animated).toBe(true);
  });

  it("does nothing for an element that is not tracked", () => {
    const mosElement = track();
    clearAllElements();

    setFinalState(mosElement);

    expect(animateSpy).not.toHaveBeenCalled();
    expect(mosElement.animated).toBe(false);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(false);
  });
});

// ===================================================================
// CLASS NAMES
// ===================================================================

describe("class handling", () => {
  it("adds no class when animatedClassName is false", () => {
    const mosElement = track({ class: "card" }, { animatedClassName: false });

    play(mosElement);
    expect(mosElement.element.className).toBe("card");
    expect(mosElement.animated).toBe(true);

    reverse(mosElement);
    expect(mosElement.element.className).toBe("card");
    expect(mosElement.animated).toBe(false);

    setFinalState(mosElement);
    expect(mosElement.element.className).toBe("card");
    expect(mosElement.animated).toBe(true);
  });

  it("uses a custom animatedClassName instead of the default", () => {
    const mosElement = track({}, { animatedClassName: "is-visible" });
    const { classList } = mosElement.element;

    play(mosElement);
    expect(classList.contains("is-visible")).toBe(true);
    expect(classList.contains("mos-animate")).toBe(false);

    reverse(mosElement);
    expect(classList.contains("is-visible")).toBe(false);
  });

  it("applies a custom animatedClassName in setFinalState", () => {
    const mosElement = track({}, { animatedClassName: "is-visible" });
    setFinalState(mosElement);

    expect(Array.from(mosElement.element.classList)).toEqual(["is-visible"]);
  });

  it("does not add the data-mos value as a class by default", () => {
    const mosElement = track({ "data-mos": "fade-up" });
    play(mosElement);

    expect(Array.from(mosElement.element.classList)).toEqual(["mos-animate"]);
  });

  it("adds and removes the data-mos value as a class with useClassNames", () => {
    const mosElement = track({ "data-mos": "fade-up" }, { useClassNames: true });
    const { classList } = mosElement.element;

    play(mosElement);
    expect(Array.from(classList).sort()).toEqual(["fade-up", "mos-animate"]);

    reverse(mosElement);
    expect(Array.from(classList)).toEqual([]);
  });

  it("splits a whitespace separated data-mos value into several classes", () => {
    const mosElement = track(
      { "data-mos": "  animate__animated \t animate__bounce ", class: "card" },
      { useClassNames: true },
    );
    const { classList } = mosElement.element;

    play(mosElement);
    expect(Array.from(classList).sort()).toEqual([
      "animate__animated",
      "animate__bounce",
      "card",
      "mos-animate",
    ]);

    reverse(mosElement);
    expect(Array.from(classList)).toEqual(["card"]);
  });

  it("adds only the data-mos classes with useClassNames and animatedClassName false", () => {
    const mosElement = track(
      { "data-mos": "fade-up" },
      { useClassNames: true, animatedClassName: false },
    );

    setFinalState(mosElement);
    expect(Array.from(mosElement.element.classList)).toEqual(["fade-up"]);

    reverse(mosElement);
    expect(Array.from(mosElement.element.classList)).toEqual([]);
  });
});

// ===================================================================
// EVENTS
// ===================================================================

describe("events", () => {
  it("dispatches mos:in on the document with the element as detail", () => {
    const mosElement = track();
    play(mosElement);

    expect(events).toEqual([{ type: "mos:in", detail: mosElement.element }]);
  });

  it("dispatches mos:out on the document with the element as detail", () => {
    const mosElement = track();
    play(mosElement);
    events = [];

    reverse(mosElement);

    expect(events).toEqual([{ type: "mos:out", detail: mosElement.element }]);
  });

  it("dispatches CustomEvents", () => {
    const seen: Event[] = [];
    const listener = (e: Event) => seen.push(e);
    document.addEventListener("mos:in", listener);

    play(track());
    document.removeEventListener("mos:in", listener);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(CustomEvent);
  });

  it("also dispatches id-suffixed events for elements with data-mos-id", () => {
    const mosElement = track({ "data-mos-id": "hero" });
    const { element } = mosElement;

    play(mosElement);
    expect(events).toEqual([
      { type: "mos:in", detail: element },
      { type: "mos:in:hero", detail: element },
    ]);

    events = [];
    reverse(mosElement);
    expect(events).toEqual([
      { type: "mos:out", detail: element },
      { type: "mos:out:hero", detail: element },
    ]);
  });

  it("does not dispatch id-suffixed events for another element's id", () => {
    const mosElement = track({ "data-mos-id": "footer" });
    play(mosElement);
    reverse(mosElement);

    expect(events.map((e) => e.type)).toEqual(["mos:in", "mos:out"]);
  });

  it("reports the class and state changes as already applied when the event fires", () => {
    const mosElement = track();
    const seen: Array<{ animated: boolean; hasClass: boolean }> = [];
    const listener = () =>
      seen.push({
        animated: mosElement.animated,
        hasClass: mosElement.element.classList.contains("mos-animate"),
      });
    document.addEventListener("mos:in", listener);
    document.addEventListener("mos:out", listener);

    play(mosElement);
    reverse(mosElement);

    document.removeEventListener("mos:in", listener);
    document.removeEventListener("mos:out", listener);
    expect(seen).toEqual([
      { animated: true, hasClass: true },
      { animated: false, hasClass: false },
    ]);
  });
});

// ===================================================================
// ANIMATION OPTIONS PASSED TO MOTION
// ===================================================================

describe("animate options", () => {
  it("converts the default ms duration to seconds and does not autoplay", () => {
    play(track());

    expect(animateArgs()[2]).toEqual({ duration: 0.4, ease: CSS_EASE, autoplay: false });
  });

  it("converts ms attributes to seconds and never hands the delay to motion", () => {
    vi.useFakeTimers();
    play(
      track({
        "data-mos-duration": "1500",
        "data-mos-delay": "250",
        "data-mos-easing": "linear",
      }),
    );

    expect(animateArgs()[2]).toEqual({ duration: 1.5, ease: "linear", autoplay: false });
    expect(animateArgs()[2]).not.toHaveProperty("delay");
    expect(animateArgs()[2]).not.toHaveProperty("fill");
  });

  it("converts a global ms duration to seconds and keeps a global delay out of the options", () => {
    vi.useFakeTimers();
    play(track({}, { duration: 800, delay: 100 }));

    expect(animateArgs()[2]).toEqual({ duration: 0.8, ease: CSS_EASE, autoplay: false });
  });

  it("passes the duration through unchanged when timeUnits is s", () => {
    vi.useFakeTimers();
    play(track({}, { timeUnits: "s", duration: 1.5, delay: 0.5 }));

    expect(animateArgs()[2]).toEqual({ duration: 1.5, ease: CSS_EASE, autoplay: false });
  });

  it("treats a per-element duration as seconds when timeUnits is s", () => {
    vi.useFakeTimers();
    play(
      track(
        { "data-mos-duration": "2", "data-mos-delay": "0.25" },
        { timeUnits: "s", duration: 1, delay: 0 },
      ),
    );

    expect(animateArgs()[2]).toEqual({ duration: 2, ease: CSS_EASE, autoplay: false });
  });

  it("uses the same options for setInitialState and setFinalState", () => {
    setInitialState(track({ "data-mos-duration": "600", "data-mos-delay": "300" }));
    setFinalState(track({ "data-mos-duration": "900", "data-mos-delay": "300" }));

    expect(animateArgs(0)[2]).toEqual({ duration: 0.6, ease: CSS_EASE, autoplay: false });
    expect(animateArgs(1)[2]).toEqual({ duration: 0.9, ease: CSS_EASE, autoplay: false });
  });
});

// ===================================================================
// SHOW DELAY
// ===================================================================

describe("show delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("plays synchronously when there is no delay", () => {
    const mosElement = track();
    play(mosElement);

    expect(controlsOf().play).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("marks the element as shown immediately but starts the animation only after the delay", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    play(mosElement);
    const controls = controlsOf();

    // shown as far as state, class and events are concerned
    expect(mosElement.animated).toBe(true);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(true);
    expect(events).toEqual([{ type: "mos:in", detail: mosElement.element }]);
    // but motion has not been started yet
    expect(controls.play).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(controls.play).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(controls.play).toHaveBeenCalledTimes(1);
    expect(controls.speed).toBe(1);

    // nothing else happens afterwards
    vi.advanceTimersByTime(10_000);
    expect(controls.play).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sets the forward speed when the delay elapses, not before", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    setInitialState(mosElement);
    const controls = controlsOf();
    controls.speed = -1;

    play(mosElement);
    expect(controls.speed).toBe(-1);

    vi.advanceTimersByTime(300);
    expect(controls.speed).toBe(1);
    expect(controls.play).toHaveBeenCalledTimes(1);
  });

  it("uses a global delay", () => {
    const mosElement = track({}, { delay: 120 });
    play(mosElement);

    vi.advanceTimersByTime(119);
    expect(controlsOf().play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(controlsOf().play).toHaveBeenCalledTimes(1);
  });

  it("interprets the delay as seconds when timeUnits is s", () => {
    const mosElement = track({ "data-mos-delay": "0.5" }, { timeUnits: "s", duration: 1 });
    play(mosElement);

    vi.advanceTimersByTime(499);
    expect(controlsOf().play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(controlsOf().play).toHaveBeenCalledTimes(1);
  });

  it("restarts the timer instead of stacking a second one when played again while pending", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    play(mosElement);
    vi.advanceTimersByTime(200);

    play(mosElement);
    expect(vi.getTimerCount()).toBe(1);

    // the first timer would have fired here
    vi.advanceTimersByTime(299);
    expect(controlsOf().play).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(controlsOf().play).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    expect(controlsOf().play).toHaveBeenCalledTimes(1);
  });

  it("only cancels the timer when reversed during the delay, leaving the controls alone", () => {
    const mosElement = track({ "data-mos-delay": "300", "data-mos-id": "hero" });
    setInitialState(mosElement);
    const controls = controlsOf();
    play(mosElement);
    vi.advanceTimersByTime(100);

    reverse(mosElement);

    expect(controls.play).not.toHaveBeenCalled();
    expect(controls.speed).toBe(1);
    expect(mosElement.animated).toBe(false);
    expect(mosElement.element.classList.contains("mos-animate")).toBe(false);
    expect(events.map((e) => e.type)).toEqual(["mos:in", "mos:in:hero", "mos:out", "mos:out:hero"]);

    // the cancelled show never fires
    vi.advanceTimersByTime(10_000);
    expect(controls.play).not.toHaveBeenCalled();
    expect(mosElement.animated).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reverses normally once the delayed show has started", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    play(mosElement);
    vi.advanceTimersByTime(300);
    const controls = controlsOf();

    reverse(mosElement);

    expect(controls.speed).toBe(-1);
    expect(controls.play).toHaveBeenCalledTimes(2);
    expect(mosElement.animated).toBe(false);
  });

  it("applies no delay on the way out", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    play(mosElement);
    vi.advanceTimersByTime(300);

    reverse(mosElement);

    // reversed synchronously, with no timer left behind
    expect(controlsOf().speed).toBe(-1);
    expect(controlsOf().play).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("delays again when shown a second time", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    play(mosElement);
    vi.advanceTimersByTime(300);
    reverse(mosElement);
    const controls = controlsOf();
    expect(controls.play).toHaveBeenCalledTimes(2);

    play(mosElement);
    // still running backwards until the delay is over
    expect(controls.speed).toBe(-1);
    expect(controls.play).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(300);
    expect(controls.speed).toBe(1);
    expect(controls.play).toHaveBeenCalledTimes(3);
  });

  it("leaves an element that is animating out alone when a second delayed show is called off", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    play(mosElement);
    vi.advanceTimersByTime(300);
    reverse(mosElement);
    const controls = controlsOf();

    play(mosElement);
    reverse(mosElement);

    // the earlier reverse keeps running; nothing is restarted
    expect(controls.speed).toBe(-1);
    expect(controls.play).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10_000);
    expect(controls.play).toHaveBeenCalledTimes(2);
    expect(mosElement.animated).toBe(false);
  });

  it("keeps separate timers for separate elements", () => {
    const make = (delay: string): MosElement => {
      const element = document.createElement("div");
      element.setAttribute("data-mos", "fade");
      element.setAttribute("data-mos-delay", delay);
      document.body.appendChild(element);
      return prepareElement(element, DEFAULT_OPTIONS)!;
    };
    const a = make("100");
    const b = make("200");
    updatePreparedElements([a, b]);

    play(a);
    play(b);
    reverse(a);

    vi.advanceTimersByTime(200);
    expect(a.controls!.play).not.toHaveBeenCalled();
    expect(b.controls!.play).toHaveBeenCalledTimes(1);
    expect(a.animated).toBe(false);
    expect(b.animated).toBe(true);
  });

  describe("cancelPendingShow", () => {
    it("returns false when nothing is pending", () => {
      const mosElement = track({ "data-mos-delay": "300" });
      expect(cancelPendingShow(mosElement)).toBe(false);

      setInitialState(mosElement);
      expect(cancelPendingShow(mosElement)).toBe(false);
    });

    it("returns false for an element that plays without a delay", () => {
      const mosElement = track();
      play(mosElement);

      expect(cancelPendingShow(mosElement)).toBe(false);
      expect(controlsOf().play).toHaveBeenCalledTimes(1);
    });

    it("cancels a pending show once and leaves the shown state untouched", () => {
      const mosElement = track({ "data-mos-delay": "300" });
      play(mosElement);

      expect(cancelPendingShow(mosElement)).toBe(true);
      expect(cancelPendingShow(mosElement)).toBe(false);

      vi.advanceTimersByTime(10_000);
      expect(controlsOf().play).not.toHaveBeenCalled();
      // only the timer is cancelled
      expect(mosElement.animated).toBe(true);
      expect(mosElement.element.classList.contains("mos-animate")).toBe(true);
      expect(events.map((e) => e.type)).toEqual(["mos:in"]);
    });

    it("returns false after the delayed show has fired", () => {
      const mosElement = track({ "data-mos-delay": "300" });
      play(mosElement);
      vi.advanceTimersByTime(300);

      expect(cancelPendingShow(mosElement)).toBe(false);
    });

    it("finds the timer through a re-created record of the same DOM element", () => {
      const mosElement = track({ "data-mos-delay": "300" });
      play(mosElement);

      // a refresh builds a new record for the element
      const recreated = prepareElement(mosElement.element, DEFAULT_OPTIONS)!;
      expect(recreated).not.toBe(mosElement);

      expect(cancelPendingShow(recreated)).toBe(true);
      vi.advanceTimersByTime(10_000);
      expect(controlsOf().play).not.toHaveBeenCalled();
    });
  });

  it("does not fire after disposeControls", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    play(mosElement);
    const controls = controlsOf();

    disposeControls(mosElement);

    expect(controls.cancel).toHaveBeenCalledTimes(1);
    expect(mosElement.controls).toBeUndefined();
    vi.advanceTimersByTime(10_000);
    expect(controls.play).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not fire after setFinalState", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    play(mosElement);
    const controls = controlsOf();
    events = [];

    setFinalState(mosElement);

    expect(controls.complete).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(controls.play).not.toHaveBeenCalled();
    expect(mosElement.animated).toBe(true);
    // it was already shown, so it is not announced again
    expect(events).toEqual([]);
  });

  it("does not delay setFinalState", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    setFinalState(mosElement);

    expect(controlsOf().complete).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts nothing for an untracked element", () => {
    const mosElement = track({ "data-mos-delay": "300" });
    clearAllElements();

    play(mosElement);

    expect(vi.getTimerCount()).toBe(0);
    expect(mosElement.animated).toBe(false);
    expect(events).toEqual([]);
  });

  it("hands the raw delay to a custom animation and plays it immediately", () => {
    const controls = { play: vi.fn(), pause: vi.fn(), complete: vi.fn(), speed: 0 };
    const factory = vi.fn((_el: HTMLElement, _opts: any) => controls as any);
    registerAnimation("animations-spec-delayed-custom", factory);
    const mosElement = track({
      "data-mos": "animations-spec-delayed-custom",
      "data-mos-delay": "300",
    });

    play(mosElement);

    expect(factory.mock.calls[0][1].delay).toBe(300);
    expect(controls.speed).toBe(1);
    expect(controls.play).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(cancelPendingShow(mosElement)).toBe(false);

    // and reversing it turns the controls around as usual
    reverse(mosElement);
    expect(controls.speed).toBe(-1);
    expect(controls.play).toHaveBeenCalledTimes(2);
  });
});

// ===================================================================
// EASING
// ===================================================================

describe("easing", () => {
  it("resolves a keyword easing", () => {
    play(track({ "data-mos-easing": "ease-in-out-back" }));

    expect(animateArgs()[2].ease).toEqual([0.68, -0.55, 0.265, 1.55]);
  });

  it("resolves an overshooting cubic-bezier string", () => {
    play(track({ "data-mos-easing": "cubic-bezier(0.68, -0.55, 0.265, 1.55)" }));

    expect(animateArgs()[2].ease).toEqual([0.68, -0.55, 0.265, 1.55]);
  });

  it("falls back to the default easing and warns when the easing is invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    play(track({ "data-mos-easing": "totally-invalid" }));

    expect(animateArgs()[2].ease).toEqual(CSS_EASE);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("totally-invalid");
  });

  it("falls back to the default easing for an invalid global easing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    play(track({}, { easing: "cubic-bezier(1,2,3)" }));

    expect(animateArgs()[2].ease).toEqual(CSS_EASE);
  });

  it("does not warn for a valid easing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    play(track({ "data-mos-easing": "ease-out" }));

    expect(animateArgs()[2].ease).toBe("easeOut");
    expect(warn).not.toHaveBeenCalled();
  });

  // An empty attribute must not override the global easing (in AOS an empty data-aos-easing
  // matches no easing rule, so the element keeps the global easing)
  it("falls back to the default easing for an empty data-mos-easing attribute", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    play(track({ "data-mos-easing": "" }));

    expect(animateArgs()[2].ease).toEqual(CSS_EASE);
  });
});

// ===================================================================
// CUSTOM DISTANCE
// ===================================================================

describe("custom distance keyframes", () => {
  const D = 42;
  const FADE = { opacity: [0, 1] };
  const ZOOM_IN = { opacity: [0, 1], scale: [0.6, 1] };
  const ZOOM_OUT = { opacity: [0, 1], scale: [1.2, 1] };

  // Up/left presets start at +distance, down/right presets start at -distance
  const EXPECTED: Array<[string, Record<string, number[]>]> = [
    ["fade-up", { ...FADE, translateY: [D, 0] }],
    ["fade-down", { ...FADE, translateY: [-D, 0] }],
    ["fade-left", { ...FADE, translateX: [D, 0] }],
    ["fade-right", { ...FADE, translateX: [-D, 0] }],
    ["fade-up-right", { ...FADE, translateY: [D, 0], translateX: [-D, 0] }],
    ["fade-up-left", { ...FADE, translateY: [D, 0], translateX: [D, 0] }],
    ["fade-down-right", { ...FADE, translateY: [-D, 0], translateX: [-D, 0] }],
    ["fade-down-left", { ...FADE, translateY: [-D, 0], translateX: [D, 0] }],
    ["slide-up", { translateY: [D, 0] }],
    ["slide-down", { translateY: [-D, 0] }],
    ["slide-left", { translateX: [D, 0] }],
    ["slide-right", { translateX: [-D, 0] }],
    ["zoom-in-up", { ...ZOOM_IN, translateY: [D, 0] }],
    ["zoom-in-down", { ...ZOOM_IN, translateY: [-D, 0] }],
    ["zoom-in-left", { ...ZOOM_IN, translateX: [D, 0] }],
    ["zoom-in-right", { ...ZOOM_IN, translateX: [-D, 0] }],
    ["zoom-out-up", { ...ZOOM_OUT, translateY: [D, 0] }],
    ["zoom-out-down", { ...ZOOM_OUT, translateY: [-D, 0] }],
    ["zoom-out-left", { ...ZOOM_OUT, translateX: [D, 0] }],
    ["zoom-out-right", { ...ZOOM_OUT, translateX: [-D, 0] }],
  ];

  it.each(EXPECTED)("%s uses data-mos-distance for its travel", (preset, expected) => {
    play(track({ "data-mos": preset, "data-mos-distance": String(D) }));

    expect(animateArgs()[1]).toEqual(expected);
  });

  it("uses a global distance option", () => {
    play(track({ "data-mos": "fade-up" }, { distance: 80 }));

    expect(animateArgs()[1]).toEqual({ opacity: [0, 1], translateY: [80, 0] });
  });

  it("lets data-mos-distance override the global distance", () => {
    play(track({ "data-mos": "slide-left", "data-mos-distance": "30" }, { distance: 80 }));

    expect(animateArgs()[1]).toEqual({ translateX: [30, 0] });
  });

  it("supports a distance of 0", () => {
    play(track({ "data-mos": "fade-up", "data-mos-distance": "0" }));

    expect(animateArgs()[1].translateY.map(Math.abs)).toEqual([0, 0]);
    expect(animateArgs()[1].opacity).toEqual([0, 1]);
  });

  it.each([
    ["fade", { opacity: [0, 1] }],
    ["zoom-in", { opacity: [0, 1], scale: [0.6, 1] }],
    ["zoom-out", { opacity: [0, 1], scale: [1.2, 1] }],
    ["flip-left", { transformPerspective: 2500, rotateY: [-100, 0] }],
    ["flip-up", { transformPerspective: 2500, rotateX: [-100, 0] }],
  ])("%s is not affected by a custom distance", (preset, expected) => {
    play(track({ "data-mos": preset, "data-mos-distance": String(D) }));

    expect(animateArgs()[1]).toEqual(expected);
  });

  it("does not mutate the built-in preset", () => {
    play(track({ "data-mos": "zoom-in-up", "data-mos-distance": String(D) }));
    play(track({ "data-mos": "zoom-in-up" }));

    expect(animateArgs(1)[1]).toEqual({ opacity: [0, 1], scale: [0.6, 1], translateY: [100, 0] });
  });

  it("leaves user-registered keyframes alone", () => {
    const custom = { rotate: [0, 360] };
    registerKeyframes("animations-spec-spin", custom);

    play(track({ "data-mos": "animations-spec-spin", "data-mos-distance": String(D) }));

    expect(animateArgs()[1]).toEqual(custom);
  });
});

// ===================================================================
// UNKNOWN PRESETS AND CUSTOM ANIMATIONS
// ===================================================================

describe("animation lookup", () => {
  it("falls back to fade for an unknown preset name", () => {
    play(track({ "data-mos": "no-such-preset" }));

    expect(animateArgs()[1]).toEqual({ opacity: [0, 1] });
  });

  it("drives the controls returned by a registered animation factory", () => {
    const controls = { play: vi.fn(), pause: vi.fn(), complete: vi.fn(), speed: 0 };
    const factory = vi.fn(() => controls as any);
    registerAnimation("animations-spec-custom", factory);
    const mosElement = track({ "data-mos": "animations-spec-custom" });

    play(mosElement);
    expect(animateSpy).not.toHaveBeenCalled();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(mosElement.controls).toBe(controls);
    expect(controls.speed).toBe(1);
    expect(controls.play).toHaveBeenCalledTimes(1);

    reverse(mosElement);
    expect(controls.speed).toBe(-1);
    expect(controls.play).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
