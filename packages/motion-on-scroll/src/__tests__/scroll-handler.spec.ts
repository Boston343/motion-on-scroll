import type { AnimationPlaybackControls } from "motion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import {
  cleanupScrollHandler,
  ensureScrollHandlerActive,
  evaluateElementPositions,
  updateScrollHandlerDelays,
} from "../helpers/scroll-handler.js";
import type { ElementOptions, MosElement } from "../helpers/types.js";

// Mock all dependencies
vi.mock("../helpers/animations.js", () => ({
  play: vi.fn(),
  reverse: vi.fn(),
  setFinalState: vi.fn(),
  setInitialState: vi.fn(),
}));

vi.mock("../helpers/elements.js", () => ({
  getPreparedElements: vi.fn(),
}));

vi.mock("../helpers/position-calculator.js", () => ({
  getPositionIn: vi.fn(),
  getPositionOut: vi.fn(),
  isElementAboveViewport: vi.fn(),
}));

vi.mock("../helpers/utils.js", () => ({
  throttle: vi.fn((fn) => fn), // Return the function unthrottled for easier testing
}));

import { play, reverse, setFinalState, setInitialState } from "../helpers/animations.js";
import { getPreparedElements } from "../helpers/elements.js";
import {
  getPositionIn,
  getPositionOut,
  isElementAboveViewport,
} from "../helpers/position-calculator.js";
import { throttle } from "../helpers/utils.js";

// ===================================================================
// TEST HELPERS
// ===================================================================

const POSITION_IN = 100;
const POSITION_OUT = 400;

function makeMosElement(
  options: Partial<ElementOptions> = {},
  state: Partial<Omit<MosElement, "element" | "options">> = {},
): MosElement {
  const element = document.createElement("div");
  element.setAttribute("data-mos", "fade");

  return {
    element,
    options: { ...DEFAULT_OPTIONS, keyframes: "fade", ...options },
    position: { in: POSITION_IN, out: false },
    animated: false,
    controls: undefined,
    ...state,
  };
}

function makeControls(): AnimationPlaybackControls {
  return {
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    speed: 1,
    time: 0,
  } as unknown as AnimationPlaybackControls;
}

function setScrollY(value: number): void {
  Object.defineProperty(window, "scrollY", { value, writable: true, configurable: true });
}

/**
 * Sets the scroll position and dispatches a real scroll event on the window
 */
function scrollTo(value: number): void {
  setScrollY(value);
  window.dispatchEvent(new Event("scroll"));
}

/**
 * Scroll listeners currently registered through the (spied) window API
 */
function scrollListenerCalls(spy: ReturnType<typeof vi.spyOn>): unknown[][] {
  return spy.mock.calls.filter(([type]) => type === "scroll");
}

describe("scroll-handler.ts", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset module state left behind by the previous test
    cleanupScrollHandler();
    updateScrollHandlerDelays(DEFAULT_OPTIONS.throttleDelay);

    setScrollY(0);

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(getPreparedElements).mockReturnValue([]);
    vi.mocked(getPositionIn).mockReturnValue(POSITION_IN);
    vi.mocked(getPositionOut).mockReturnValue(POSITION_OUT);
    vi.mocked(isElementAboveViewport).mockReturnValue(false);

    // Setup spies for window event listeners
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    cleanupScrollHandler();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  // ===================================================================
  // SCROLL HANDLER LIFECYCLE
  // ===================================================================

  describe("ensureScrollHandlerActive", () => {
    it("should register a passive scroll listener throttled with the default delay", () => {
      ensureScrollHandlerActive();

      expect(throttle).toHaveBeenCalledTimes(1);
      expect(throttle).toHaveBeenCalledWith(expect.any(Function), 99);
      expect(scrollListenerCalls(addEventListenerSpy)).toEqual([
        ["scroll", vi.mocked(throttle).mock.results[0].value, { passive: true }],
      ]);
    });

    it("should prevent multiple initializations", () => {
      ensureScrollHandlerActive();
      ensureScrollHandlerActive();
      ensureScrollHandlerActive();

      expect(scrollListenerCalls(addEventListenerSpy)).toHaveLength(1);
      expect(throttle).toHaveBeenCalledTimes(1);
    });

    it("should process each scroll event exactly once however often it is called", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      ensureScrollHandlerActive();
      ensureScrollHandlerActive();

      scrollTo(POSITION_IN);

      expect(play).toHaveBeenCalledTimes(1);
    });

    it("should allow reinitialization after cleanup", () => {
      ensureScrollHandlerActive();
      cleanupScrollHandler();
      ensureScrollHandlerActive();

      expect(scrollListenerCalls(addEventListenerSpy)).toHaveLength(2);
      expect(scrollListenerCalls(removeEventListenerSpy)).toHaveLength(1);
    });
  });

  describe("cleanupScrollHandler", () => {
    it("should remove the registered scroll listener", () => {
      ensureScrollHandlerActive();
      const [, scrollHandler] = scrollListenerCalls(addEventListenerSpy)[0];

      cleanupScrollHandler();

      expect(scrollListenerCalls(removeEventListenerSpy)).toEqual([["scroll", scrollHandler]]);
    });

    it("should stop reacting to scroll events", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      ensureScrollHandlerActive();

      cleanupScrollHandler();
      scrollTo(POSITION_IN + 500);

      expect(play).not.toHaveBeenCalled();
      expect(reverse).not.toHaveBeenCalled();
    });

    it("should do nothing when no handler is active", () => {
      cleanupScrollHandler();

      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });

    it("should allow multiple cleanup calls safely", () => {
      ensureScrollHandlerActive();
      cleanupScrollHandler();
      cleanupScrollHandler();
      cleanupScrollHandler();

      expect(scrollListenerCalls(removeEventListenerSpy)).toHaveLength(1);
    });
  });

  // ===================================================================
  // CONFIGURATION MANAGEMENT
  // ===================================================================

  describe("updateScrollHandlerDelays", () => {
    it("should not register a listener when no handler is active", () => {
      updateScrollHandlerDelays(150);

      expect(throttle).not.toHaveBeenCalled();
      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });

    it("should use the new delay for a handler that is created afterwards", () => {
      updateScrollHandlerDelays(150);

      ensureScrollHandlerActive();

      expect(throttle).toHaveBeenCalledTimes(1);
      expect(throttle).toHaveBeenCalledWith(expect.any(Function), 150);
    });

    it("should re-create an active listener when the delay changes", () => {
      ensureScrollHandlerActive();
      const [, originalHandler] = scrollListenerCalls(addEventListenerSpy)[0];

      updateScrollHandlerDelays(200);

      // Old listener removed, a new one registered with the new delay
      expect(scrollListenerCalls(removeEventListenerSpy)).toEqual([["scroll", originalHandler]]);
      expect(scrollListenerCalls(addEventListenerSpy)).toHaveLength(2);
      expect(throttle).toHaveBeenCalledTimes(2);
      expect(throttle).toHaveBeenLastCalledWith(expect.any(Function), 200);

      const [, newHandler, listenerOptions] = scrollListenerCalls(addEventListenerSpy)[1];
      expect(newHandler).toBe(vi.mocked(throttle).mock.results[1].value);
      expect(listenerOptions).toEqual({ passive: true });
    });

    it("should leave exactly one working listener after the delay changed", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      ensureScrollHandlerActive();

      updateScrollHandlerDelays(200);
      scrollTo(POSITION_IN);

      expect(play).toHaveBeenCalledTimes(1);
      expect(play).toHaveBeenCalledWith(mosElement);
    });

    it("should not re-create an active listener when the delay is unchanged", () => {
      ensureScrollHandlerActive();

      updateScrollHandlerDelays(99);
      updateScrollHandlerDelays(99);

      expect(throttle).toHaveBeenCalledTimes(1);
      expect(scrollListenerCalls(addEventListenerSpy)).toHaveLength(1);
      expect(scrollListenerCalls(removeEventListenerSpy)).toHaveLength(0);
    });

    it("should only re-create the listener once when the same new delay is applied repeatedly", () => {
      ensureScrollHandlerActive();

      updateScrollHandlerDelays(200);
      updateScrollHandlerDelays(200);
      updateScrollHandlerDelays(200);

      expect(throttle).toHaveBeenCalledTimes(2);
      expect(scrollListenerCalls(addEventListenerSpy)).toHaveLength(2);
      expect(scrollListenerCalls(removeEventListenerSpy)).toHaveLength(1);
    });

    it("should remember a delay set while inactive and not re-create for it later", () => {
      updateScrollHandlerDelays(200);
      ensureScrollHandlerActive();

      updateScrollHandlerDelays(200);

      expect(throttle).toHaveBeenCalledTimes(1);
      expect(scrollListenerCalls(removeEventListenerSpy)).toHaveLength(0);
    });
  });

  // ===================================================================
  // SHOW / HIDE DECISION TABLE
  // ===================================================================

  describe("scroll event processing", () => {
    type Expected = "play" | "reverse" | "nothing";
    type Row = {
      name: string;
      options: Partial<ElementOptions>;
      out: number | false;
      animated: boolean;
      scrollY: number;
      expected: Expected;
    };

    const rows: Row[] = [
      // --- default (no once, no mirror) ---
      {
        name: "hidden element below its trigger stays hidden",
        options: {},
        out: false,
        animated: false,
        scrollY: POSITION_IN - 1,
        expected: "nothing",
      },
      {
        name: "hidden element exactly at its trigger is shown",
        options: {},
        out: false,
        animated: false,
        scrollY: POSITION_IN,
        expected: "play",
      },
      {
        name: "hidden element past its trigger is shown",
        options: {},
        out: false,
        animated: false,
        scrollY: POSITION_IN + 5000,
        expected: "play",
      },
      {
        name: "shown element exactly at its trigger stays shown",
        options: {},
        out: false,
        animated: true,
        scrollY: POSITION_IN,
        expected: "nothing",
      },
      {
        name: "shown element past its trigger is not played again",
        options: {},
        out: false,
        animated: true,
        scrollY: POSITION_IN + 5000,
        expected: "nothing",
      },
      {
        name: "shown element scrolled back above its trigger is hidden",
        options: {},
        out: false,
        animated: true,
        scrollY: POSITION_IN - 1,
        expected: "reverse",
      },
      {
        name: "shown non-mirror element is not hidden by a stray out position",
        options: { mirror: false },
        out: POSITION_OUT,
        animated: true,
        scrollY: POSITION_OUT + 50,
        expected: "nothing",
      },
      // --- once ---
      {
        name: "once: hidden element at its trigger is shown",
        options: { once: true },
        out: false,
        animated: false,
        scrollY: POSITION_IN,
        expected: "play",
      },
      {
        name: "once: hidden element below its trigger stays hidden",
        options: { once: true },
        out: false,
        animated: false,
        scrollY: POSITION_IN - 1,
        expected: "nothing",
      },
      {
        name: "once: shown element scrolled back above its trigger stays shown",
        options: { once: true },
        out: false,
        animated: true,
        scrollY: POSITION_IN - 1,
        expected: "nothing",
      },
      {
        name: "once: shown element past its trigger is not played again",
        options: { once: true },
        out: false,
        animated: true,
        scrollY: POSITION_IN + 50,
        expected: "nothing",
      },
      // --- mirror ---
      {
        name: "mirror: hidden element between in and out is shown",
        options: { mirror: true },
        out: POSITION_OUT,
        animated: false,
        scrollY: POSITION_OUT - 1,
        expected: "play",
      },
      {
        name: "mirror: shown element between in and out stays shown",
        options: { mirror: true },
        out: POSITION_OUT,
        animated: true,
        scrollY: POSITION_OUT - 1,
        expected: "nothing",
      },
      {
        name: "mirror: shown element exactly at its out position is hidden",
        options: { mirror: true },
        out: POSITION_OUT,
        animated: true,
        scrollY: POSITION_OUT,
        expected: "reverse",
      },
      {
        name: "mirror: shown element scrolled past its out position is hidden",
        options: { mirror: true },
        out: POSITION_OUT,
        animated: true,
        scrollY: POSITION_OUT + 50,
        expected: "reverse",
      },
      {
        name: "mirror: hidden element past its out position is not shown",
        options: { mirror: true },
        out: POSITION_OUT,
        animated: false,
        scrollY: POSITION_OUT + 50,
        expected: "nothing",
      },
      {
        name: "mirror: shown element scrolled back above its trigger is hidden",
        options: { mirror: true },
        out: POSITION_OUT,
        animated: true,
        scrollY: POSITION_IN - 1,
        expected: "reverse",
      },
      {
        name: "mirror: hidden element below its trigger stays hidden",
        options: { mirror: true },
        out: POSITION_OUT,
        animated: false,
        scrollY: POSITION_IN - 1,
        expected: "nothing",
      },
      {
        name: "mirror without an out position: shown element far down the page stays shown",
        options: { mirror: true },
        out: false,
        animated: true,
        scrollY: POSITION_OUT + 50,
        expected: "nothing",
      },
      // --- mirror + once (once wins) ---
      {
        name: "mirror + once: shown element past the out position stays shown",
        options: { mirror: true, once: true },
        out: POSITION_OUT,
        animated: true,
        scrollY: POSITION_OUT + 50,
        expected: "nothing",
      },
      {
        name: "mirror + once: hidden element past the out position is shown",
        options: { mirror: true, once: true },
        out: POSITION_OUT,
        animated: false,
        scrollY: POSITION_OUT + 50,
        expected: "play",
      },
      {
        name: "mirror + once: shown element scrolled back above its trigger stays shown",
        options: { mirror: true, once: true },
        out: false,
        animated: true,
        scrollY: POSITION_IN - 1,
        expected: "nothing",
      },
    ];

    it.each(rows)("$name", ({ options, out, animated, scrollY, expected }) => {
      const mosElement = makeMosElement(
        options,
        // Shown elements always have controls
        { position: { in: POSITION_IN, out }, animated, controls: makeControls() },
      );
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      ensureScrollHandlerActive();

      scrollTo(scrollY);

      if (expected === "play") {
        expect(play).toHaveBeenCalledTimes(1);
        expect(play).toHaveBeenCalledWith(mosElement);
      } else {
        expect(play).not.toHaveBeenCalled();
      }

      if (expected === "reverse") {
        expect(reverse).toHaveBeenCalledTimes(1);
        expect(reverse).toHaveBeenCalledWith(mosElement);
      } else {
        expect(reverse).not.toHaveBeenCalled();
      }

      // Scrolling only ever plays or reverses - it never snaps an element to a state
      expect(setInitialState).not.toHaveBeenCalled();
      expect(setFinalState).not.toHaveBeenCalled();
    });

    it("should not consult an isReversing flag when deciding to hide", () => {
      // Regression: the old handler skipped hiding (and re-played) based on isReversing
      const mosElement = makeMosElement(
        { mirror: true },
        { position: { in: POSITION_IN, out: POSITION_OUT }, animated: true },
      );
      (mosElement as MosElement & { isReversing?: boolean }).isReversing = true;
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      ensureScrollHandlerActive();

      scrollTo(POSITION_OUT + 50);
      expect(reverse).toHaveBeenCalledTimes(1);

      scrollTo(POSITION_IN + 1);
      expect(play).not.toHaveBeenCalled();
    });

    it("should decide independently for every tracked element", () => {
      const below = makeMosElement({}, { position: { in: 900, out: false } });
      const entering = makeMosElement({}, { position: { in: 200, out: false } });
      const shown = makeMosElement({}, { position: { in: 50, out: false }, animated: true });
      const leaving = makeMosElement({}, { position: { in: 700, out: false }, animated: true });
      const onceShown = makeMosElement(
        { once: true },
        { position: { in: 700, out: false }, animated: true },
      );
      vi.mocked(getPreparedElements).mockReturnValue([below, entering, shown, leaving, onceShown]);
      ensureScrollHandlerActive();

      scrollTo(500);

      expect(vi.mocked(play).mock.calls).toEqual([[entering]]);
      expect(vi.mocked(reverse).mock.calls).toEqual([[leaving]]);
    });

    it("should read the tracked elements again on every scroll event", () => {
      const first = makeMosElement();
      const second = makeMosElement();
      ensureScrollHandlerActive();

      vi.mocked(getPreparedElements).mockReturnValue([first]);
      scrollTo(POSITION_IN);
      vi.mocked(getPreparedElements).mockReturnValue([second]);
      scrollTo(POSITION_IN + 1);

      expect(vi.mocked(play).mock.calls).toEqual([[first], [second]]);
    });

    it("should show, hide and show again as the page scrolls down, up and down", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(play).mockImplementation((mosEl) => {
        mosEl.animated = true;
      });
      vi.mocked(reverse).mockImplementation((mosEl) => {
        mosEl.animated = false;
      });
      ensureScrollHandlerActive();

      scrollTo(POSITION_IN + 10);
      scrollTo(POSITION_IN + 20); // still shown, nothing new
      expect(play).toHaveBeenCalledTimes(1);
      expect(reverse).not.toHaveBeenCalled();

      scrollTo(POSITION_IN - 10);
      scrollTo(POSITION_IN - 20); // still hidden, nothing new
      expect(play).toHaveBeenCalledTimes(1);
      expect(reverse).toHaveBeenCalledTimes(1);

      scrollTo(POSITION_IN);
      expect(play).toHaveBeenCalledTimes(2);
      expect(reverse).toHaveBeenCalledTimes(1);
    });

    it("should not throw for elements with an undefined in position", () => {
      const mosElement = makeMosElement();
      mosElement.position.in = undefined as unknown as number;
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      ensureScrollHandlerActive();

      expect(() => scrollTo(150)).not.toThrow();
      expect(play).not.toHaveBeenCalled();
    });
  });

  // ===================================================================
  // POSITION EVALUATION
  // ===================================================================

  describe("evaluateElementPositions", () => {
    it("should recalculate the in position for every element with its own options", () => {
      const first = makeMosElement({ offset: 10 }, { position: { in: -1, out: false } });
      const second = makeMosElement({ offset: 20 }, { position: { in: -1, out: false } });
      vi.mocked(getPreparedElements).mockReturnValue([first, second]);
      vi.mocked(getPositionIn).mockImplementation((_el, opts) => 1000 + opts.offset);

      evaluateElementPositions();

      expect(getPositionIn).toHaveBeenCalledWith(first.element, first.options);
      expect(getPositionIn).toHaveBeenCalledWith(second.element, second.options);
      expect(first.position).toEqual({ in: 1010, out: false });
      expect(second.position).toEqual({ in: 1020, out: false });
    });

    it("should calculate an out position only for mirror elements without once", () => {
      const plain = makeMosElement();
      const mirror = makeMosElement({ mirror: true });
      const mirrorOnce = makeMosElement({ mirror: true, once: true });
      vi.mocked(getPreparedElements).mockReturnValue([plain, mirror, mirrorOnce]);

      evaluateElementPositions();

      expect(plain.position.out).toBe(false);
      expect(mirror.position.out).toBe(POSITION_OUT);
      expect(mirrorOnce.position.out).toBe(false);
      expect(getPositionOut).toHaveBeenCalledTimes(1);
      expect(getPositionOut).toHaveBeenCalledWith(mirror.element, mirror.options);
    });

    it("should recalculate positions of already animated elements too", () => {
      const shown = makeMosElement(
        { mirror: true },
        { position: { in: -1, out: -1 }, animated: true, controls: makeControls() },
      );
      vi.mocked(getPreparedElements).mockReturnValue([shown]);
      setScrollY(POSITION_IN + 1);

      evaluateElementPositions();

      expect(shown.position).toEqual({ in: POSITION_IN, out: POSITION_OUT });
    });

    // --- not animated ---

    it("should set the initial state for a not-animated element in or below the viewport", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(false);

      evaluateElementPositions();

      expect(isElementAboveViewport).toHaveBeenCalledWith(mosElement.element);
      expect(setInitialState).toHaveBeenCalledTimes(1);
      expect(setInitialState).toHaveBeenCalledWith(mosElement);
      expect(setFinalState).not.toHaveBeenCalled();
    });

    it("should set the final state for a not-animated element above the viewport that is past its trigger", () => {
      const above = makeMosElement();
      const below = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([above, below]);
      vi.mocked(isElementAboveViewport).mockImplementation((el) => el === above.element);
      vi.mocked(getPositionIn).mockImplementation((el) => (el === above.element ? 100 : 5000));
      setScrollY(1000);

      evaluateElementPositions();

      expect(vi.mocked(setFinalState).mock.calls).toEqual([[above]]);
      expect(vi.mocked(setInitialState).mock.calls).toEqual([[below]]);
    });

    it("should set the final state when the scroll position is exactly at the trigger", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(true);
      setScrollY(POSITION_IN);

      evaluateElementPositions();

      expect(vi.mocked(setFinalState).mock.calls).toEqual([[mosElement]]);
      expect(setInitialState).not.toHaveBeenCalled();
    });

    // Regression: an element above the viewport is not necessarily due yet (anchored to
    // something further down, or a top-top placement). Finalising it would be undone by
    // the scroll pass right away: mos:in immediately followed by mos:out on every refresh.
    it("should set the initial state for an element above the viewport whose trigger is not reached", () => {
      const mosElement = makeMosElement({ anchor: "#far-below" });
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(true);
      vi.mocked(getPositionIn).mockReturnValue(5000);
      setScrollY(1000);

      evaluateElementPositions();

      expect(vi.mocked(setInitialState).mock.calls).toEqual([[mosElement]]);
      expect(setFinalState).not.toHaveBeenCalled();
      expect(play).not.toHaveBeenCalled();
      expect(reverse).not.toHaveBeenCalled();
    });

    it("should compare the scroll position with the recalculated trigger, not the stale one", () => {
      // stale position says "past the trigger", the new layout says "not yet"
      const notDue = makeMosElement({}, { position: { in: 0, out: false } });
      // stale position says "not yet", the new layout says "past the trigger"
      const due = makeMosElement({}, { position: { in: 9000, out: false } });
      vi.mocked(getPreparedElements).mockReturnValue([notDue, due]);
      vi.mocked(isElementAboveViewport).mockReturnValue(true);
      vi.mocked(getPositionIn).mockImplementation((el) => (el === notDue.element ? 5000 : 200));
      setScrollY(1000);

      evaluateElementPositions();

      expect(vi.mocked(setInitialState).mock.calls).toEqual([[notDue]]);
      expect(vi.mocked(setFinalState).mock.calls).toEqual([[due]]);
    });

    it("should not show and hide an untriggered element above the viewport on repeated refreshes", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(true);
      vi.mocked(getPositionIn).mockReturnValue(5000);
      // behave like the real state setters as far as the flag is concerned
      vi.mocked(setFinalState).mockImplementation((el) => {
        el.animated = true;
      });
      vi.mocked(play).mockImplementation((el) => {
        el.animated = true;
      });
      setScrollY(1000);

      evaluateElementPositions();
      evaluateElementPositions();
      evaluateElementPositions();

      expect(setFinalState).not.toHaveBeenCalled();
      expect(play).not.toHaveBeenCalled();
      expect(reverse).not.toHaveBeenCalled();
      expect(mosElement.animated).toBe(false);
    });

    it("should not play an element again that was just put in its final state", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(true);
      vi.mocked(setFinalState).mockImplementation((el) => {
        el.animated = true;
      });
      setScrollY(POSITION_IN + 2000);

      evaluateElementPositions();

      expect(setFinalState).toHaveBeenCalledTimes(1);
      expect(play).not.toHaveBeenCalled();
      expect(reverse).not.toHaveBeenCalled();
      expect(mosElement.animated).toBe(true);
    });

    it("should set the initial state for a not-animated mirror element above the viewport", () => {
      const mosElement = makeMosElement({ mirror: true });
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(true);
      // past both its in and its out position
      setScrollY(POSITION_OUT + 1000);

      evaluateElementPositions();

      expect(vi.mocked(setInitialState).mock.calls).toEqual([[mosElement]]);
      expect(setFinalState).not.toHaveBeenCalled();
    });

    it("should hand a hidden element that already has controls to setInitialState, not setFinalState", () => {
      // e.g. an element that was reversed: setInitialState itself leaves existing controls alone
      const mosElement = makeMosElement({}, { controls: makeControls() });
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);

      evaluateElementPositions();

      expect(setFinalState).not.toHaveBeenCalled();
      expect(mosElement.controls!.pause).not.toHaveBeenCalled();
      expect(mosElement.controls!.complete).not.toHaveBeenCalled();
    });

    // --- animated ---

    it("should leave an animated element that has controls alone", () => {
      const controls = makeControls();
      const mosElement = makeMosElement({}, { animated: true, controls });
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      setScrollY(POSITION_IN + 50);

      evaluateElementPositions();

      expect(setInitialState).not.toHaveBeenCalled();
      expect(setFinalState).not.toHaveBeenCalled();
      expect(play).not.toHaveBeenCalled();
      expect(reverse).not.toHaveBeenCalled();
      expect(isElementAboveViewport).not.toHaveBeenCalled();
      expect(mosElement.animated).toBe(true);
      expect(mosElement.controls).toBe(controls);
      expect(controls.pause).not.toHaveBeenCalled();
      expect(controls.complete).not.toHaveBeenCalled();
    });

    it("should leave an animated element with controls alone even if it is above the viewport", () => {
      const mosElement = makeMosElement({}, { animated: true, controls: makeControls() });
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(true);
      setScrollY(POSITION_IN + 5000);

      evaluateElementPositions();

      expect(setInitialState).not.toHaveBeenCalled();
      expect(setFinalState).not.toHaveBeenCalled();
    });

    it("should set the final state for an animated element whose controls were dropped", () => {
      const mosElement = makeMosElement({}, { animated: true, controls: undefined });
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      setScrollY(POSITION_IN + 50);

      evaluateElementPositions();

      expect(vi.mocked(setFinalState).mock.calls).toEqual([[mosElement]]);
      expect(setInitialState).not.toHaveBeenCalled();
      // It is shown already: it must not be played (and announced) again
      expect(play).not.toHaveBeenCalled();
      expect(reverse).not.toHaveBeenCalled();
    });

    it("should treat each element according to its own state", () => {
      const fresh = makeMosElement();
      const shown = makeMosElement({}, { animated: true, controls: makeControls() });
      const rebuilt = makeMosElement({}, { animated: true });
      vi.mocked(getPreparedElements).mockReturnValue([fresh, shown, rebuilt]);
      vi.mocked(getPositionIn).mockImplementation((el) => (el === fresh.element ? 5000 : 0));
      setScrollY(100);

      evaluateElementPositions();

      expect(vi.mocked(setInitialState).mock.calls).toEqual([[fresh]]);
      expect(vi.mocked(setFinalState).mock.calls).toEqual([[rebuilt]]);
      expect(play).not.toHaveBeenCalled();
      expect(reverse).not.toHaveBeenCalled();
    });

    // --- processing the current scroll position ---

    it("should play elements that are already in view using the recalculated positions", () => {
      const inView = makeMosElement({}, { position: { in: 99999, out: false } });
      const below = makeMosElement({}, { position: { in: -99999, out: false } });
      vi.mocked(getPreparedElements).mockReturnValue([inView, below]);
      vi.mocked(getPositionIn).mockImplementation((el) => (el === inView.element ? 100 : 900));
      setScrollY(150);

      evaluateElementPositions();

      // The stale positions would have given the opposite result
      expect(vi.mocked(play).mock.calls).toEqual([[inView]]);
      expect(reverse).not.toHaveBeenCalled();
    });

    it("should set the state before processing the scroll position", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      setScrollY(POSITION_IN);

      evaluateElementPositions();

      const initialOrder = vi.mocked(setInitialState).mock.invocationCallOrder[0];
      const playOrder = vi.mocked(play).mock.invocationCallOrder[0];
      expect(initialOrder).toBeLessThan(playOrder);
    });

    it("should hide a shown element that the new layout moved back below the viewport", () => {
      const mosElement = makeMosElement({}, { animated: true, controls: makeControls() });
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      vi.mocked(getPositionIn).mockReturnValue(5000);
      setScrollY(100);

      evaluateElementPositions();

      expect(vi.mocked(reverse).mock.calls).toEqual([[mosElement]]);
      expect(setInitialState).not.toHaveBeenCalled();
    });

    it("should not need an active scroll listener", () => {
      const mosElement = makeMosElement();
      vi.mocked(getPreparedElements).mockReturnValue([mosElement]);
      setScrollY(POSITION_IN);

      evaluateElementPositions();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(play).toHaveBeenCalledWith(mosElement);
    });

    it("should do nothing when no elements are tracked", () => {
      evaluateElementPositions();

      expect(getPositionIn).not.toHaveBeenCalled();
      expect(setInitialState).not.toHaveBeenCalled();
      expect(setFinalState).not.toHaveBeenCalled();
      expect(play).not.toHaveBeenCalled();
      expect(reverse).not.toHaveBeenCalled();
    });
  });
});
