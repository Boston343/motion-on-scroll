import type { AnimationPlaybackControls } from "motion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cancelPendingShow, play } from "../helpers/animations.js";
import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import {
  clearAllElements,
  disposeControls,
  findPreparedElement,
  getMosElements,
  getPreparedElements,
  prepareElement,
  prepareElements,
  updatePreparedElements,
} from "../helpers/elements.js";
import type { ElementOptions, MosElement, MosOptions } from "../helpers/types.js";

// ===================================================================
// TEST HELPERS
// ===================================================================
// Nothing is mocked here: options come from the real attribute resolver and
// positions from the real position calculator. jsdom has no layout, so the
// offsets the calculator reads are stubbed per element.

const WINDOW_HEIGHT = 800;

/**
 * Creates a `[data-mos]` element attached to the body at a fake layout position
 */
function createElement(
  animation: string | null,
  top = 0,
  height = 100,
  attributes: Record<string, string> = {},
): HTMLElement {
  const element = document.createElement("div");
  if (animation !== null) element.setAttribute("data-mos", animation);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  setLayout(element, top, height);
  document.body.appendChild(element);
  return element;
}

function setLayout(element: HTMLElement, top: number, height = 100): void {
  Object.defineProperty(element, "offsetTop", { value: top, configurable: true });
  Object.defineProperty(element, "offsetHeight", { value: height, configurable: true });
  Object.defineProperty(element, "offsetParent", { value: null, configurable: true });
}

/**
 * Minimal stand-in for Motion's playback controls
 */
function createControls(): AnimationPlaybackControls & { cancel: ReturnType<typeof vi.fn> } {
  return {
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    speed: 1,
    time: 0,
  } as unknown as AnimationPlaybackControls & { cancel: ReturnType<typeof vi.fn> };
}

describe("elements.ts", () => {
  let element1: HTMLElement;
  let element2: HTMLElement;
  let options: MosOptions;

  beforeEach(() => {
    clearAllElements();
    document.body.innerHTML = "";

    Object.defineProperty(window, "innerHeight", { value: WINDOW_HEIGHT, configurable: true });

    element1 = createElement("fade", 1000, 100);
    element1.id = "element1";
    element2 = createElement("slide-up", 2000, 200);
    element2.id = "element2";

    options = { ...DEFAULT_OPTIONS };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAllElements();
    document.body.innerHTML = "";
  });

  // ===================================================================
  // DOM ELEMENT DISCOVERY
  // ===================================================================

  describe("getMosElements", () => {
    it("should query the DOM when no prepared elements exist", () => {
      const querySpy = vi.spyOn(document, "querySelectorAll");

      const result = getMosElements();

      expect(querySpy).toHaveBeenCalledWith("[data-mos]");
      expect(result).toEqual([element1, element2]);
    });

    it("should return the tracked elements without querying the DOM by default", () => {
      prepareElements([element1], options);
      const querySpy = vi.spyOn(document, "querySelectorAll");

      const result = getMosElements();

      expect(querySpy).not.toHaveBeenCalled();
      expect(result).toEqual([element1]);
    });

    it("should re-query the DOM when findNewElements is true", () => {
      prepareElements([element1], options);
      const added = createElement("zoom-in", 3000);

      expect(getMosElements(false)).toEqual([element1]);
      expect(getMosElements(true)).toEqual([element1, element2, added]);
    });

    it("should find elements with an empty data-mos attribute", () => {
      const empty = createElement("", 3000);

      expect(getMosElements()).toEqual([element1, element2, empty]);
    });

    it("should not return elements without a data-mos attribute", () => {
      createElement(null, 500);

      expect(getMosElements(true)).toEqual([element1, element2]);
    });
  });

  // ===================================================================
  // SINGLE ELEMENT PREPARATION
  // ===================================================================

  describe("prepareElement", () => {
    it("should build a fresh, un-animated MosElement", () => {
      const result = prepareElement(element1, options);

      expect(result).not.toBeNull();
      expect(result!.element).toBe(element1);
      expect(result!.animated).toBe(false);
      expect(result!.controls).toBeUndefined();
      expect(result!.options).toEqual({ ...DEFAULT_OPTIONS, keyframes: "fade" });
    });

    it("should no longer carry an isReversing flag", () => {
      const result = prepareElement(element1, options);

      expect(result).not.toHaveProperty("isReversing");
      expect(Object.keys(result!).sort()).toEqual([
        "animated",
        "controls",
        "element",
        "options",
        "position",
      ]);
    });

    it("should return null for an element without a data-mos attribute", () => {
      const plain = createElement(null);

      expect(prepareElement(plain, options)).toBeNull();
    });

    it("should calculate the in position from the element offset, viewport and offset option", () => {
      const result = prepareElement(element1, options);

      // top (1000) - window height (800) + offset (120)
      expect(result!.position.in).toBe(320);
    });

    it("should not calculate an out position without mirror", () => {
      const result = prepareElement(element1, options);

      expect(result!.position.out).toBe(false);
    });

    it("should calculate an out position when mirror is true and once is false", () => {
      const result = prepareElement(element1, { ...options, mirror: true, once: false });

      // top (1000) + height (100) - offset (120)
      expect(result!.position.out).toBe(980);
    });

    it("should not calculate an out position when once is true, even with mirror", () => {
      const result = prepareElement(element1, { ...options, mirror: true, once: true });

      expect(result!.position.out).toBe(false);
    });

    it("should let data attributes override the global options", () => {
      const element = createElement("zoom-in", 1000, 100, {
        "data-mos-duration": "900",
        "data-mos-offset": "0",
        "data-mos-mirror": "true",
        "data-mos-id": "hero",
      });

      const result = prepareElement(element, { ...options, duration: 250 });

      expect(result!.options.keyframes).toBe("zoom-in");
      expect(result!.options.duration).toBe(900);
      expect(result!.options.id).toBe("hero");
      expect(result!.position).toEqual({ in: 200, out: 1100 });
    });

    // `data-mos=""` is matched by the `[data-mos]` selector, the observer and the stylesheet,
    // so it has to be tracked too (AOS tracks every `[data-aos]` element)
    it("should track an element whose data-mos attribute is empty, using the fade preset", () => {
      const empty = createElement("", 1000);

      const result = prepareElement(empty, options);

      expect(result).not.toBeNull();
      expect(result!.element).toBe(empty);
      expect(result!.options.keyframes).toBe("fade");
    });
  });

  // ===================================================================
  // ELEMENT PREPARATION
  // ===================================================================

  describe("prepareElements", () => {
    it("should prepare every element in order and return the tracked list", () => {
      const result = prepareElements([element1, element2], options);

      expect(result.map((mosEl) => mosEl.element)).toEqual([element1, element2]);
      expect(result.map((mosEl) => mosEl.options.keyframes)).toEqual(["fade", "slide-up"]);
      expect(result.map((mosEl) => mosEl.position.in)).toEqual([320, 1320]);
      expect(getPreparedElements()).toBe(result);
    });

    it("should replace the previously tracked list", () => {
      prepareElements([element1], options);

      prepareElements([element2], options);

      expect(getPreparedElements().map((mosEl) => mosEl.element)).toEqual([element2]);
    });

    it("should skip elements without a data-mos attribute", () => {
      const plain = createElement(null);

      const result = prepareElements([element1, plain, element2], options);

      expect(result.map((mosEl) => mosEl.element)).toEqual([element1, element2]);
      expect(plain.classList.contains("mos-init")).toBe(false);
    });

    it("should track elements whose data-mos attribute is empty", () => {
      const empty = createElement("", 3000);

      const result = prepareElements([element1, empty], options);

      expect(result.map((mosEl) => mosEl.element)).toEqual([element1, empty]);
      expect(result[1].options.keyframes).toBe("fade");
      expect(empty.classList.contains("mos-init")).toBe(true);
      expect(findPreparedElement(empty)).toBe(result[1]);
    });

    it("should keep the state of an already tracked element with an empty data-mos attribute", () => {
      const empty = createElement("", 3000);
      const [first] = prepareElements([empty], options);
      const controls = createControls();
      first.controls = controls;
      first.animated = true;

      const [second] = prepareElements([empty], options);

      expect(second.animated).toBe(true);
      expect(second.controls).toBe(controls);
      expect(controls.cancel).not.toHaveBeenCalled();
    });

    it("should handle an empty element list", () => {
      prepareElements([element1], options);

      expect(prepareElements([], options)).toEqual([]);
      expect(getPreparedElements()).toEqual([]);
    });

    it("should start new elements un-animated and without controls", () => {
      const [mosElement] = prepareElements([element1], options);

      expect(mosElement.animated).toBe(false);
      expect(mosElement.controls).toBeUndefined();
    });
  });

  // ===================================================================
  // STATE REUSE ACROSS PREPARATIONS
  // ===================================================================

  describe("prepareElements state reuse", () => {
    /**
     * Prepares both elements and marks the first one as shown with live controls
     */
    function prepareAnimated(initial: MosOptions = options) {
      const [first, second] = prepareElements([element1, element2], initial);
      const controls = createControls();
      first.animated = true;
      first.controls = controls;
      return { first, second, controls };
    }

    it("should carry over the animated flag of an already tracked element", () => {
      prepareAnimated();

      const [first, second] = prepareElements([element1, element2], options);

      expect(first.animated).toBe(true);
      expect(second.animated).toBe(false);
    });

    it("should carry over the controls when the options are unchanged", () => {
      const { controls } = prepareAnimated();

      const [first, second] = prepareElements([element1, element2], { ...options });

      expect(first.controls).toBe(controls);
      expect(controls.cancel).not.toHaveBeenCalled();
      expect(second.controls).toBeUndefined();
    });

    it("should carry over the controls of an element that is not animated", () => {
      const [, second] = prepareElements([element1, element2], options);
      const controls = createControls();
      second.controls = controls;

      const [, secondAgain] = prepareElements([element1, element2], options);

      expect(secondAgain.animated).toBe(false);
      expect(secondAgain.controls).toBe(controls);
      expect(controls.cancel).not.toHaveBeenCalled();
    });

    it("should keep reusing the state across several preparations", () => {
      const { controls } = prepareAnimated();

      prepareElements([element1, element2], options);
      prepareElements([element2, element1], options);
      const result = prepareElements([element1, element2], options);

      expect(result[0].animated).toBe(true);
      expect(result[0].controls).toBe(controls);
      expect(controls.cancel).not.toHaveBeenCalled();
    });

    it.each([
      ["duration", { duration: 800 }],
      ["delay", { delay: 150 }],
      ["distance", { distance: 40 }],
      ["easing", { easing: "ease-in-out" }],
      ["timeUnits", { timeUnits: "s" }],
    ] as Array<[string, Partial<MosOptions>]>)(
      "should cancel and drop the controls when the global %s changes",
      (_name, change) => {
        const { controls } = prepareAnimated();

        const [first] = prepareElements([element1, element2], { ...options, ...change });

        expect(controls.cancel).toHaveBeenCalledTimes(1);
        expect(first.controls).toBeUndefined();
        expect(first.options).toMatchObject(change);
        // The element is still shown - only its animation has to be rebuilt
        expect(first.animated).toBe(true);
      },
    );

    it.each([
      ["keyframes", "data-mos", "zoom-in"],
      ["duration", "data-mos-duration", "800"],
      ["delay", "data-mos-delay", "150"],
      ["distance", "data-mos-distance", "40"],
      ["easing", "data-mos-easing", "ease-in-out"],
    ])(
      "should cancel and drop the controls when the element's %s attribute changes",
      (_name, attribute, value) => {
        const { controls } = prepareAnimated();
        const [, second] = getPreparedElements();
        const otherControls = createControls();
        second.controls = otherControls;

        element1.setAttribute(attribute, value);
        const [first, secondAgain] = prepareElements([element1, element2], options);

        expect(controls.cancel).toHaveBeenCalledTimes(1);
        expect(first.controls).toBeUndefined();
        expect(first.animated).toBe(true);

        // The untouched element keeps its animation
        expect(otherControls.cancel).not.toHaveBeenCalled();
        expect(secondAgain.controls).toBe(otherControls);
      },
    );

    it.each([
      ["offset", { offset: 0 }],
      ["once", { once: true }],
      ["mirror", { mirror: true }],
      ["anchorPlacement", { anchorPlacement: "center-center" }],
      ["throttleDelay", { throttleDelay: 20 }],
      ["animatedClassName", { animatedClassName: "shown" }],
    ] as Array<[string, Partial<MosOptions>]>)(
      "should keep the controls when only %s changes",
      (_name, change) => {
        const { controls } = prepareAnimated();

        const [first] = prepareElements([element1, element2], { ...options, ...change });

        expect(controls.cancel).not.toHaveBeenCalled();
        expect(first.controls).toBe(controls);
        expect(first.animated).toBe(true);
        expect(first.options).toMatchObject(change);
      },
    );

    it("should recalculate positions for elements whose state is reused", () => {
      const { controls } = prepareAnimated();

      setLayout(element1, 5000, 100);
      const [first] = prepareElements([element1, element2], options);

      expect(first.position.in).toBe(5000 - WINDOW_HEIGHT + 120);
      expect(first.controls).toBe(controls);
    });

    it("should cancel the controls of elements that are no longer in the list", () => {
      const { first, controls } = prepareAnimated();

      const result = prepareElements([element2], options);

      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(first.controls).toBeUndefined();
      expect(result.map((mosEl) => mosEl.element)).toEqual([element2]);
      expect(findPreparedElement(element1)).toBeUndefined();
    });

    it("should cancel the controls of an element that lost its data-mos attribute", () => {
      const { controls } = prepareAnimated();

      element1.removeAttribute("data-mos");
      const result = prepareElements([element1, element2], options);

      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(result.map((mosEl) => mosEl.element)).toEqual([element2]);
    });

    it("should cancel every tracked element's controls when the list becomes empty", () => {
      const { controls, second } = prepareAnimated();
      const otherControls = createControls();
      second.controls = otherControls;

      prepareElements([], options);

      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(otherControls.cancel).toHaveBeenCalledTimes(1);
    });

    it("should treat a removed and re-added element as new", () => {
      const { controls } = prepareAnimated();

      prepareElements([element2], options);
      const [first] = prepareElements([element1, element2], options);

      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(first.animated).toBe(false);
      expect(first.controls).toBeUndefined();
    });

    it("should not break when cancel() throws for an element whose animation changed", () => {
      const { controls, second } = prepareAnimated();
      controls.cancel.mockImplementation(() => {
        throw new Error("detached");
      });
      const otherControls = createControls();
      second.controls = otherControls;

      let result: MosElement[] = [];
      expect(() => {
        result = prepareElements([element1, element2], { ...options, duration: 800 });
      }).not.toThrow();

      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(result.map((mosEl) => mosEl.element)).toEqual([element1, element2]);
      expect(result[0].controls).toBeUndefined();
      expect(result[0].animated).toBe(true);
      // Elements after the throwing one are still processed
      expect(otherControls.cancel).toHaveBeenCalledTimes(1);
      expect(result[1].controls).toBeUndefined();
      expect(element2.classList.contains("mos-init")).toBe(true);
    });

    it("should not break when cancel() throws for a removed element", () => {
      const { controls, second } = prepareAnimated();
      controls.cancel.mockImplementation(() => {
        throw new Error("detached");
      });
      const otherControls = createControls();
      second.controls = otherControls;
      const third = createElement("zoom-in", 3000);

      let result: MosElement[] = [];
      expect(() => {
        result = prepareElements([third], options);
      }).not.toThrow();

      expect(result.map((mosEl) => mosEl.element)).toEqual([third]);
      expect(controls.cancel).toHaveBeenCalledTimes(1);
      // The other removed element is still cleaned up
      expect(otherControls.cancel).toHaveBeenCalledTimes(1);
    });
  });

  // ===================================================================
  // INIT CLASS NAME
  // ===================================================================

  describe("initClassName", () => {
    it("should add the default mos-init class to every prepared element", () => {
      prepareElements([element1, element2], options);

      expect(element1.classList.contains("mos-init")).toBe(true);
      expect(element2.classList.contains("mos-init")).toBe(true);
    });

    it("should not add the animated class while preparing", () => {
      prepareElements([element1], options);

      expect(element1.classList.contains("mos-animate")).toBe(false);
    });

    it("should add a custom init class instead of the default", () => {
      prepareElements([element1], { ...options, initClassName: "ready" });

      expect(element1.className).toBe("ready");
    });

    it("should add no class when initClassName is false", () => {
      prepareElements([element1, element2], { ...options, initClassName: false });

      expect(element1.className).toBe("");
      expect(element2.className).toBe("");
    });

    it("should keep existing classes and not duplicate the init class on re-preparation", () => {
      element1.className = "card";

      prepareElements([element1], options);
      prepareElements([element1], options);

      expect(element1.className).toBe("card mos-init");
    });

    it("should not add the init class through prepareElement alone", () => {
      prepareElement(element1, options);

      expect(element1.classList.contains("mos-init")).toBe(false);
    });
  });

  // ===================================================================
  // CONTROLS DISPOSAL
  // ===================================================================

  describe("disposeControls", () => {
    it("should cancel the controls and forget them", () => {
      const [mosElement] = prepareElements([element1], options);
      const controls = createControls();
      mosElement.controls = controls;

      disposeControls(mosElement);

      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(mosElement.controls).toBeUndefined();
    });

    it("should leave the animated flag and classes alone", () => {
      const [mosElement] = prepareElements([element1], options);
      mosElement.controls = createControls();
      mosElement.animated = true;
      element1.classList.add("mos-animate");

      disposeControls(mosElement);

      expect(mosElement.animated).toBe(true);
      expect(element1.className).toBe("mos-init mos-animate");
    });

    it("should do nothing for an element without controls", () => {
      const [mosElement] = prepareElements([element1], options);

      expect(() => disposeControls(mosElement)).not.toThrow();
      expect(mosElement.controls).toBeUndefined();
    });

    it("should swallow errors thrown by cancel() and still forget the controls", () => {
      const [mosElement] = prepareElements([element1], options);
      const controls = createControls();
      controls.cancel.mockImplementation(() => {
        throw new Error("detached");
      });
      mosElement.controls = controls;

      expect(() => disposeControls(mosElement)).not.toThrow();
      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(mosElement.controls).toBeUndefined();
    });
  });

  // ===================================================================
  // PENDING DELAYED SHOWS
  // ===================================================================
  // play() waits out the show delay with a timer. Whenever the controls of an
  // element are let go of, that timer must go too.

  describe("pending delayed shows", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Tracks element1 with a 300ms delay and starts showing it */
    function showWithDelay(): { mosElement: MosElement; controls: AnimationPlaybackControls } {
      element1.setAttribute("data-mos-delay", "300");
      const [mosElement] = prepareElements([element1], options);
      play(mosElement);
      expect(mosElement.animated).toBe(true);
      expect(mosElement.controls!.play).not.toHaveBeenCalled();
      return { mosElement, controls: mosElement.controls! };
    }

    it("disposeControls should cancel a pending show", () => {
      const { mosElement, controls } = showWithDelay();

      disposeControls(mosElement);
      vi.advanceTimersByTime(10_000);

      expect(controls.play).not.toHaveBeenCalled();
      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(cancelPendingShow(mosElement)).toBe(false);
    });

    it("should keep a pending show running on the same controls across a re-preparation", () => {
      const { controls } = showWithDelay();
      vi.advanceTimersByTime(100);

      const [again] = prepareElements([element1], options);
      expect(again.controls).toBe(controls);
      expect(again.animated).toBe(true);

      // the delay is not restarted by the refresh
      vi.advanceTimersByTime(199);
      expect(controls.play).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.cancel).not.toHaveBeenCalled();
    });

    it("should let the re-created record cancel the pending show", () => {
      const { controls } = showWithDelay();

      const [again] = prepareElements([element1], options);
      expect(cancelPendingShow(again)).toBe(true);

      vi.advanceTimersByTime(10_000);
      expect(controls.play).not.toHaveBeenCalled();
    });

    it("should cancel a pending show when the animation changed", () => {
      const { controls } = showWithDelay();

      const [again] = prepareElements([element1], { ...options, duration: 900 });
      vi.advanceTimersByTime(10_000);

      expect(again.controls).toBeUndefined();
      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(controls.play).not.toHaveBeenCalled();
    });

    it("should cancel a pending show when the element is no longer in the list", () => {
      const { controls } = showWithDelay();

      prepareElements([element2], options);
      vi.advanceTimersByTime(10_000);

      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(controls.play).not.toHaveBeenCalled();
    });

    it("should cancel a pending show when the element lost its data-mos attribute", () => {
      const { controls } = showWithDelay();

      element1.removeAttribute("data-mos");
      prepareElements([element1], options);
      vi.advanceTimersByTime(10_000);

      expect(controls.play).not.toHaveBeenCalled();
    });
  });

  // ===================================================================
  // ELEMENT ACCESS AND MANAGEMENT
  // ===================================================================

  describe("getPreparedElements", () => {
    it("should return an empty array when nothing is prepared", () => {
      expect(getPreparedElements()).toEqual([]);
    });

    it("should return all prepared elements", () => {
      prepareElements([element1, element2], options);

      expect(getPreparedElements().map((mosEl) => mosEl.element)).toEqual([element1, element2]);
    });
  });

  describe("findPreparedElement", () => {
    it("should find the tracked entry for an element", () => {
      const [, second] = prepareElements([element1, element2], options);

      expect(findPreparedElement(element2)).toBe(second);
    });

    it("should return undefined for an element that is not tracked", () => {
      prepareElements([element1], options);

      expect(findPreparedElement(element2)).toBeUndefined();
    });

    it("should return undefined when nothing is prepared", () => {
      expect(findPreparedElement(element1)).toBeUndefined();
    });
  });

  describe("updatePreparedElements", () => {
    function makeMosElement(element: HTMLElement, partial: Partial<MosElement> = {}): MosElement {
      return {
        element,
        options: { ...DEFAULT_OPTIONS, keyframes: "fade" } as ElementOptions,
        position: { in: 100, out: false },
        animated: false,
        controls: undefined,
        ...partial,
      };
    }

    it("should replace the tracked list", () => {
      prepareElements([element1, element2], options);
      const replacement = makeMosElement(element1, {
        position: { in: 150, out: 250 },
        animated: true,
      });

      updatePreparedElements([replacement]);

      expect(getPreparedElements()).toEqual([replacement]);
      expect(findPreparedElement(element1)).toBe(replacement);
      expect(findPreparedElement(element2)).toBeUndefined();
    });

    it("should make the given entries the state that the next preparation reuses", () => {
      const controls = createControls();
      updatePreparedElements([
        makeMosElement(element1, {
          options: { ...DEFAULT_OPTIONS, keyframes: "fade" } as ElementOptions,
          animated: true,
          controls,
        }),
      ]);

      const [first] = prepareElements([element1], options);

      expect(first.animated).toBe(true);
      expect(first.controls).toBe(controls);
    });

    it("should handle an empty array", () => {
      prepareElements([element1], options);

      updatePreparedElements([]);

      expect(getPreparedElements()).toEqual([]);
    });
  });

  describe("clearAllElements", () => {
    it("should forget all prepared elements", () => {
      prepareElements([element1, element2], options);

      clearAllElements();

      expect(getPreparedElements()).toEqual([]);
      expect(findPreparedElement(element1)).toBeUndefined();
    });

    it("should not cancel the animations of the forgotten elements", () => {
      const [mosElement] = prepareElements([element1], options);
      const controls = createControls();
      mosElement.controls = controls;

      clearAllElements();

      expect(controls.cancel).not.toHaveBeenCalled();
      expect(mosElement.controls).toBe(controls);
    });

    it("should make later preparations start from scratch", () => {
      const [mosElement] = prepareElements([element1], options);
      mosElement.animated = true;
      mosElement.controls = createControls();

      clearAllElements();
      const [fresh] = prepareElements([element1], options);

      expect(fresh.animated).toBe(false);
      expect(fresh.controls).toBeUndefined();
    });

    it("should work when no elements are prepared", () => {
      expect(() => clearAllElements()).not.toThrow();
      expect(getPreparedElements()).toEqual([]);
    });
  });
});
