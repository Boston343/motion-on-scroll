import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import type { MosOptions } from "../helpers/types.js";

// ===================================================================
// MODULE SPIES
// ===================================================================
// The helpers keep their real behaviour - they are only wrapped in spies so
// the tests can inspect what index.ts hands to them. `motion` itself is
// mocked globally in vitest.setup.ts.
//
// The spies are registered with vi.doMock() for every fresh copy of the library
// (see loadModules). A hoisted vi.mock() factory is evaluated only once, so its
// `actual` module would keep pointing at the helper instances of the first test
// while index.ts gets new ones after vi.resetModules() - leaving two copies of
// e.g. animations.ts (and of its module state) in play.

function mockHelpers(): void {
  vi.doMock("../helpers/elements.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../helpers/elements.js")>();
    return {
      ...actual,
      clearAllElements: vi.fn(actual.clearAllElements),
      getMosElements: vi.fn(actual.getMosElements),
      prepareElements: vi.fn(actual.prepareElements),
    };
  });

  vi.doMock("../helpers/scroll-handler.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../helpers/scroll-handler.js")>();
    return {
      ...actual,
      cleanupScrollHandler: vi.fn(actual.cleanupScrollHandler),
      ensureScrollHandlerActive: vi.fn(actual.ensureScrollHandlerActive),
      evaluateElementPositions: vi.fn(actual.evaluateElementPositions),
      updateScrollHandlerDelays: vi.fn(actual.updateScrollHandlerDelays),
    };
  });

  vi.doMock("../helpers/observer.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../helpers/observer.js")>();
    return {
      ...actual,
      startDomObserver: vi.fn(actual.startDomObserver),
      stopDomObserver: vi.fn(actual.stopDomObserver),
    };
  });
}

// ===================================================================
// TEST HELPERS
// ===================================================================

/**
 * Fake MutationObserver that records its instances so tests can check
 * whether the library connected / disconnected it
 */
class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];
  public connected = false;
  public disconnect = vi.fn(() => {
    this.connected = false;
  });
  public observe = vi.fn(() => {
    this.connected = true;
  });
  public takeRecords = vi.fn(() => []);

  constructor(public callback: MutationCallback) {
    FakeMutationObserver.instances.push(this);
  }
}

type TrackedListener = {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject | null;
};

/** Listeners that were added and not (yet) removed through removeEventListener */
let activeListeners: TrackedListener[] = [];
let untrackListeners: (() => void)[] = [];

/**
 * Wraps add/removeEventListener of a target so the net set of registered listeners is known
 */
function trackListeners(target: EventTarget): void {
  const originalAdd = target.addEventListener.bind(target);
  const originalRemove = target.removeEventListener.bind(target);

  vi.spyOn(target, "addEventListener").mockImplementation(((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) => {
    activeListeners.push({ target, type, listener });
    originalAdd(type, listener, options);
  }) as typeof target.addEventListener);

  vi.spyOn(target, "removeEventListener").mockImplementation(((
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) => {
    const index = activeListeners.findIndex(
      (entry) => entry.target === target && entry.type === type && entry.listener === listener,
    );
    if (index >= 0) activeListeners.splice(index, 1);
    originalRemove(type, listener, options);
  }) as typeof target.removeEventListener);

  untrackListeners.push(() => {
    activeListeners
      .filter((entry) => entry.target === target)
      .forEach((entry) => originalRemove(entry.type, entry.listener));
  });
}

/** Number of listeners of a type currently registered on a target */
function listenerCount(target: EventTarget, type: string): number {
  return activeListeners.filter((entry) => entry.target === target && entry.type === type).length;
}

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, "readyState", { configurable: true, value: state });
}

function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn((query: string) => ({ matches, media: query }));
  (window as any).matchMedia = matchMedia;
  return matchMedia;
}

function addMosElement(animation = "fade", attributes: Record<string, string> = {}) {
  const element = document.createElement("div");
  element.setAttribute("data-mos", animation);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  document.body.appendChild(element);
  return element;
}

/** Names of all data-mos* attributes still present on an element */
function mosAttributes(element: Element): string[] {
  return Array.from(element.attributes)
    .map((attribute) => attribute.name)
    .filter((name) => name.startsWith("data-mos"));
}

/** Fires the default start event */
function fireStart(): void {
  document.dispatchEvent(new Event("DOMContentLoaded"));
}

type Loaded = Awaited<ReturnType<typeof loadModules>>;

/**
 * Loads a fresh copy of the library (index.ts keeps module-level state)
 */
async function loadModules() {
  vi.resetModules();
  mockHelpers();
  const index = await import("../index.js");
  const elements = await import("../helpers/elements.js");
  const scrollHandler = await import("../helpers/scroll-handler.js");
  const observer = await import("../helpers/observer.js");
  const motion = await import("motion");
  const animations = await import("../helpers/animations.js");
  const easing = await import("../helpers/easing.js");
  const keyframes = await import("../helpers/keyframes.js");

  return {
    index,
    animations,
    easing,
    keyframes,
    animate: vi.mocked(motion.animate),
    clearAllElements: vi.mocked(elements.clearAllElements),
    getMosElements: vi.mocked(elements.getMosElements),
    getPreparedElements: elements.getPreparedElements,
    prepareElements: vi.mocked(elements.prepareElements),
    cleanupScrollHandler: vi.mocked(scrollHandler.cleanupScrollHandler),
    ensureScrollHandlerActive: vi.mocked(scrollHandler.ensureScrollHandlerActive),
    evaluateElementPositions: vi.mocked(scrollHandler.evaluateElementPositions),
    updateScrollHandlerDelays: vi.mocked(scrollHandler.updateScrollHandlerDelays),
    startDomObserver: vi.mocked(observer.startDomObserver),
    stopDomObserver: vi.mocked(observer.stopDomObserver),
  };
}

describe("index.ts - Main Entry Point", () => {
  let mos: Loaded;
  let element1: HTMLElement;
  let element2: HTMLElement;

  /** Options object handed to the most recent prepareElements() call */
  const lastOptions = (): MosOptions => {
    const call = mos.prepareElements.mock.lastCall;
    expect(call).toBeDefined();
    return call![1];
  };

  /** Elements handed to the most recent prepareElements() call */
  const lastElements = (): HTMLElement[] => mos.prepareElements.mock.lastCall![0];

  beforeEach(async () => {
    vi.useFakeTimers();

    document.body.innerHTML = "";
    element1 = addMosElement("fade");
    element2 = addMosElement("slide-up");

    setReadyState("loading");
    setViewport(1280);

    FakeMutationObserver.instances = [];
    vi.stubGlobal("MutationObserver", FakeMutationObserver);

    activeListeners = [];
    untrackListeners = [];
    trackListeners(window);
    trackListeners(document);

    mos = await loadModules();
  });

  afterEach(() => {
    try {
      mos.index.destroy();
    } catch {
      // a test about destroy() reports this itself
    }

    // Make sure nothing registered by this test can leak into the next one
    untrackListeners.forEach((untrack) => untrack());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();

    delete (document as any).readyState;
    delete (window as any).matchMedia;
    document.body.innerHTML = "";
  });

  // ===================================================================
  // EXPORTS
  // ===================================================================

  describe("exports", () => {
    it("exposes the full public API on the MOS object", () => {
      const { MOS } = mos.index;

      expect(Object.keys(MOS).sort()).toEqual(
        [
          "destroy",
          "init",
          "refresh",
          "refreshHard",
          "registerAnimation",
          "registerEasing",
          "registerKeyframes",
        ].sort(),
      );
      Object.values(MOS).forEach((member) => expect(typeof member).toBe("function"));
    });

    it("exports MOS as the default export", () => {
      expect(mos.index.default).toBe(mos.index.MOS);
    });

    it("has named exports that are the same functions as the MOS members", () => {
      const { MOS } = mos.index;

      expect(mos.index.init).toBe(MOS.init);
      expect(mos.index.refresh).toBe(MOS.refresh);
      expect(mos.index.refreshHard).toBe(MOS.refreshHard);
      expect(mos.index.destroy).toBe(MOS.destroy);
      expect(mos.index.registerKeyframes).toBe(MOS.registerKeyframes);
      expect(mos.index.registerEasing).toBe(MOS.registerEasing);
      expect(mos.index.registerAnimation).toBe(MOS.registerAnimation);
    });

    it("re-exports the register functions of the helper modules", () => {
      expect(mos.index.registerKeyframes).toBe(mos.keyframes.registerKeyframes);
      expect(mos.index.registerEasing).toBe(mos.easing.registerEasing);
      expect(mos.index.registerAnimation).toBe(mos.animations.registerAnimation);
    });
  });

  // ===================================================================
  // init()
  // ===================================================================

  describe("init()", () => {
    it("returns the MOS elements found in the DOM", () => {
      expect(mos.index.init()).toEqual([element1, element2]);
    });

    it("does not prepare anything before the start event fired", () => {
      mos.index.init();

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(mos.getPreparedElements()).toEqual([]);
      expect(element1.classList.contains("mos-init")).toBe(false);
    });

    it("prepares the found elements with the default options once the start event fires", () => {
      mos.index.init();
      fireStart();

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(lastElements()).toEqual([element1, element2]);
      expect(lastOptions()).toEqual(DEFAULT_OPTIONS);
      expect(mos.getPreparedElements().map((mosEl) => mosEl.element)).toEqual([element1, element2]);
      expect(element1.classList.contains("mos-init")).toBe(true);
      expect(element2.classList.contains("mos-init")).toBe(true);
    });

    it("activates the scroll handler and evaluates positions on start", () => {
      mos.index.init();
      expect(listenerCount(window, "scroll")).toBe(0);

      fireStart();

      expect(listenerCount(window, "scroll")).toBe(1);
      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(1);
    });

    it("merges the given options on top of the defaults", () => {
      mos.index.init({ duration: 800, easing: "ease-in-out", delay: 100 });
      fireStart();

      expect(lastOptions()).toEqual({
        ...DEFAULT_OPTIONS,
        duration: 800,
        easing: "ease-in-out",
        delay: 100,
      });
    });

    it("does not mutate DEFAULT_OPTIONS", () => {
      const snapshot = { ...DEFAULT_OPTIONS };

      mos.index.init({ duration: 800, timeUnits: "s", once: true });
      fireStart();

      expect(DEFAULT_OPTIONS).toEqual(snapshot);
    });

    it("passes the configured throttle delay to the scroll handler", () => {
      mos.index.init({ throttleDelay: 150 });
      fireStart();

      expect(mos.updateScrollHandlerDelays).toHaveBeenLastCalledWith(150);
    });

    it("re-prepares with the new options when called again after activation", () => {
      mos.index.init();
      fireStart();

      const result = mos.index.init({ duration: 600 });

      expect(result).toEqual([element1, element2]);
      expect(mos.prepareElements).toHaveBeenCalledTimes(2);
      expect(lastOptions().duration).toBe(600);
      expect(mos.getPreparedElements()[0]!.options.duration).toBe(600);
    });

    describe("option accumulation across calls", () => {
      it("keeps options from earlier calls made before the start event", () => {
        mos.index.init({ duration: 800 });
        mos.index.init({ offset: 50 });
        fireStart();

        expect(lastOptions()).toEqual({ ...DEFAULT_OPTIONS, duration: 800, offset: 50 });
      });

      it("keeps options from earlier calls made after activation", () => {
        mos.index.init({ duration: 800, once: true });
        fireStart();
        mos.index.init({ offset: 50 });
        mos.index.init({ easing: "linear" });

        expect(lastOptions()).toEqual({
          ...DEFAULT_OPTIONS,
          duration: 800,
          once: true,
          offset: 50,
          easing: "linear",
        });
      });

      it("lets a later call override an earlier value", () => {
        mos.index.init({ duration: 800, offset: 50 });
        mos.index.init({ duration: 300 });
        fireStart();

        expect(lastOptions().duration).toBe(300);
        expect(lastOptions().offset).toBe(50);
      });

      it("keeps earlier options when called again without arguments", () => {
        mos.index.init({ duration: 800 });
        fireStart();
        mos.index.init();

        expect(lastOptions().duration).toBe(800);
      });
    });

    describe("MutationObserver", () => {
      it("starts observing the DOM by default", () => {
        mos.index.init();

        expect(mos.startDomObserver).toHaveBeenCalledTimes(1);
        expect(FakeMutationObserver.instances).toHaveLength(1);
        expect(FakeMutationObserver.instances[0]!.connected).toBe(true);
      });

      it("does not observe the DOM when disableMutationObserver is true", () => {
        mos.index.init({ disableMutationObserver: true });

        expect(mos.startDomObserver).not.toHaveBeenCalled();
        expect(FakeMutationObserver.instances).toHaveLength(0);
      });

      it("does not observe the DOM (or throw) when MutationObserver is not supported", () => {
        vi.stubGlobal("MutationObserver", undefined);

        expect(() => mos.index.init()).not.toThrow();
        expect(mos.startDomObserver).not.toHaveBeenCalled();
      });

      it("leaves only one connected observer when init() is called twice before start", () => {
        mos.index.init();
        mos.index.init();

        const connected = FakeMutationObserver.instances.filter((instance) => instance.connected);
        expect(connected).toHaveLength(1);
      });
    });
  });

  // ===================================================================
  // TIME UNITS
  // ===================================================================

  describe("timeUnits", () => {
    it("uses millisecond defaults when timeUnits is 'ms'", () => {
      mos.index.init({ timeUnits: "ms" });
      fireStart();

      expect(lastOptions().duration).toBe(400);
      expect(lastOptions().delay).toBe(0);
    });

    it("converts the default duration and delay to seconds on the first init", () => {
      mos.index.init({ timeUnits: "s" });
      fireStart();

      expect(lastOptions().timeUnits).toBe("s");
      expect(lastOptions().duration).toBe(0.4);
      expect(lastOptions().delay).toBe(0);
    });

    it("still gives 0.4s on a second init({ timeUnits: 's' }) after activation", () => {
      mos.index.init({ timeUnits: "s" });
      fireStart();
      mos.index.init({ timeUnits: "s" });

      expect(mos.prepareElements).toHaveBeenCalledTimes(2);
      expect(lastOptions().duration).toBe(0.4);
      expect(lastOptions().delay).toBe(0);
    });

    it("still gives 0.4s on later init calls that do not mention timeUnits", () => {
      mos.index.init({ timeUnits: "s" });
      fireStart();
      mos.index.init({ offset: 10 });
      mos.index.init();

      expect(lastOptions().timeUnits).toBe("s");
      expect(lastOptions().duration).toBe(0.4);
      expect(lastOptions().delay).toBe(0);
    });

    it("still gives 0.4s when init is called twice before the start event", () => {
      mos.index.init({ timeUnits: "s" });
      mos.index.init({ timeUnits: "s" });
      fireStart();

      expect(lastOptions().duration).toBe(0.4);
    });

    it("converts the defaults when timeUnits 's' only arrives in a later init call", () => {
      mos.index.init();
      fireStart();
      expect(lastOptions().duration).toBe(400);

      mos.index.init({ timeUnits: "s" });

      expect(lastOptions().duration).toBe(0.4);
      expect(lastOptions().delay).toBe(0);
    });

    it("keeps an explicit duration and delay as given", () => {
      mos.index.init({ timeUnits: "s", duration: 1.5, delay: 0.2 });
      fireStart();

      expect(lastOptions().duration).toBe(1.5);
      expect(lastOptions().delay).toBe(0.2);
    });

    it("converts only the value that was not given explicitly", () => {
      mos.index.init({ timeUnits: "s", delay: 0.5 });
      fireStart();

      expect(lastOptions().duration).toBe(0.4);
      expect(lastOptions().delay).toBe(0.5);

      mos.index.destroy();
      mos.index.init({ timeUnits: "s", duration: 2 });
      fireStart();

      expect(lastOptions().duration).toBe(2);
      expect(lastOptions().delay).toBe(0);
    });

    it("keeps an explicit duration that was passed in an earlier init call", () => {
      mos.index.init({ duration: 2, delay: 1 });
      fireStart();
      mos.index.init({ timeUnits: "s" });

      expect(lastOptions().duration).toBe(2);
      expect(lastOptions().delay).toBe(1);
    });

    it("keeps an explicit duration on init calls after the one that set it", () => {
      mos.index.init({ timeUnits: "s", duration: 1.5 });
      fireStart();
      mos.index.init({ timeUnits: "s" });
      mos.index.init({ once: true });

      expect(lastOptions().duration).toBe(1.5);
      expect(lastOptions().delay).toBe(0);
    });

    it("keeps an explicit duration of 0", () => {
      mos.index.init({ timeUnits: "s", duration: 0 });
      fireStart();

      expect(lastOptions().duration).toBe(0);
    });

    it("goes back to millisecond defaults when timeUnits is switched back to 'ms'", () => {
      mos.index.init({ timeUnits: "s" });
      fireStart();
      mos.index.init({ timeUnits: "ms" });

      expect(lastOptions().duration).toBe(400);
      expect(lastOptions().delay).toBe(0);
    });

    it("hands motion a duration in seconds either way", () => {
      mos.index.init({ timeUnits: "s" });
      fireStart();
      mos.index.init({ timeUnits: "s" });

      expect(mos.animate).toHaveBeenCalled();
      mos.animate.mock.calls.forEach((call) => {
        expect((call as any[])[2]).toEqual({
          duration: 0.4,
          ease: [0.25, 0.1, 0.25, 1],
          autoplay: false,
        });
      });
    });
  });

  // ===================================================================
  // LISTENERS
  // ===================================================================

  describe("listeners", () => {
    it("registers one resize, one orientationchange and one start listener", () => {
      mos.index.init();

      expect(listenerCount(window, "resize")).toBe(1);
      expect(listenerCount(window, "orientationchange")).toBe(1);
      expect(listenerCount(document, "DOMContentLoaded")).toBe(1);
    });

    it("leaves exactly one of each listener when init() is called twice before start", () => {
      mos.index.init();
      mos.index.init({ duration: 500 });

      expect(listenerCount(window, "resize")).toBe(1);
      expect(listenerCount(window, "orientationchange")).toBe(1);
      expect(listenerCount(document, "DOMContentLoaded")).toBe(1);
    });

    it("starts only once when init() was called several times before the start event", () => {
      mos.index.init();
      mos.index.init();
      mos.index.init();
      fireStart();

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("handles a resize only once when init() was called twice before start", () => {
      mos.index.init();
      mos.index.init();
      fireStart();
      mos.evaluateElementPositions.mockClear();

      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(1000);

      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(1);
    });

    it("handles an orientation change only once when init() was called twice before start", () => {
      mos.index.init();
      mos.index.init();
      fireStart();
      mos.evaluateElementPositions.mockClear();

      window.dispatchEvent(new Event("orientationchange"));
      vi.advanceTimersByTime(1000);

      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(1);
    });

    it("moves the start listener when a second init() changes startEvent", () => {
      mos.index.init();
      mos.index.init({ startEvent: "load" });

      expect(listenerCount(document, "DOMContentLoaded")).toBe(0);
      expect(listenerCount(window, "load")).toBe(1);

      fireStart();
      expect(mos.prepareElements).not.toHaveBeenCalled();

      window.dispatchEvent(new Event("load"));
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("does not add listeners when init() is called again after activation", () => {
      mos.index.init();
      fireStart();
      mos.index.init({ duration: 500 });
      mos.index.init();

      expect(listenerCount(window, "resize")).toBe(1);
      expect(listenerCount(window, "orientationchange")).toBe(1);
      expect(listenerCount(window, "scroll")).toBe(1);
    });

    it("debounces layout changes with the configured debounceDelay", () => {
      mos.index.init({ debounceDelay: 200 });
      fireStart();
      mos.evaluateElementPositions.mockClear();

      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(199);
      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(1);
    });

    it("ignores layout changes before the start event fired", () => {
      mos.index.init();

      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(1000);

      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
    });
  });

  describe("handleLayoutChange()", () => {
    it("does nothing while the library is inactive", () => {
      mos.index.handleLayoutChange();

      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
    });

    it("re-evaluates positions once the library is active", () => {
      mos.index.init();
      fireStart();
      mos.evaluateElementPositions.mockClear();

      mos.index.handleLayoutChange();

      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(1);
    });
  });

  // ===================================================================
  // START EVENT
  // ===================================================================

  describe("startEvent", () => {
    it("waits for DOMContentLoaded while the document is still loading", () => {
      mos.index.init();

      expect(mos.prepareElements).not.toHaveBeenCalled();

      fireStart();

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it.each(["interactive", "complete"] as const)(
      "starts immediately when DOMContentLoaded already fired (readyState %s)",
      (readyState) => {
        setReadyState(readyState);

        mos.index.init();

        expect(mos.prepareElements).toHaveBeenCalledTimes(1);
        expect(lastElements()).toEqual([element1, element2]);
        expect(listenerCount(document, "DOMContentLoaded")).toBe(0);
        // layout listeners are still needed
        expect(listenerCount(window, "resize")).toBe(1);
        expect(listenerCount(window, "orientationchange")).toBe(1);
      },
    );

    it("waits for the window load event when startEvent is 'load'", () => {
      setReadyState("interactive");

      mos.index.init({ startEvent: "load" });

      expect(listenerCount(window, "load")).toBe(1);
      expect(listenerCount(document, "DOMContentLoaded")).toBe(0);

      fireStart();
      expect(mos.prepareElements).not.toHaveBeenCalled();

      window.dispatchEvent(new Event("load"));
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("starts immediately when startEvent is 'load' and the page already loaded", () => {
      setReadyState("complete");

      mos.index.init({ startEvent: "load" });

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(listenerCount(window, "load")).toBe(0);
    });

    it("waits for a custom event on document, even when the page already loaded", () => {
      setReadyState("complete");

      mos.index.init({ startEvent: "my-app:ready" });

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(listenerCount(document, "my-app:ready")).toBe(1);

      fireStart();
      window.dispatchEvent(new Event("my-app:ready"));
      expect(mos.prepareElements).not.toHaveBeenCalled();

      document.dispatchEvent(new Event("my-app:ready"));
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("reacts to the start event only once", () => {
      mos.index.init({ startEvent: "my-app:ready" });

      document.dispatchEvent(new Event("my-app:ready"));
      document.dispatchEvent(new Event("my-app:ready"));

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("setupStartEventListener() returns a cleanup that removes the listener", () => {
      const cleanup = mos.index.setupStartEventListener();

      expect(typeof cleanup).toBe("function");
      expect(listenerCount(document, "DOMContentLoaded")).toBe(1);

      cleanup();

      expect(listenerCount(document, "DOMContentLoaded")).toBe(0);
      fireStart();
      expect(mos.prepareElements).not.toHaveBeenCalled();
    });

    it("setupStartEventListener() returns a callable cleanup when it started immediately", () => {
      setReadyState("complete");

      const cleanup = mos.index.setupStartEventListener();

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(() => cleanup()).not.toThrow();
    });
  });

  // ===================================================================
  // DISABLE PATH
  // ===================================================================

  describe("disable", () => {
    let decorated: HTMLElement;

    beforeEach(() => {
      decorated = addMosElement("fade-up", {
        "data-mos-delay": "100",
        "data-mos-id": "hero",
        "data-mos-anchor-placement": "top-center",
        "data-other": "keep",
        class: "keep mos-init mos-animate",
      });
    });

    /** Asserts that MOS stripped the elements and set nothing up */
    const expectDisabled = (result: HTMLElement[]) => {
      expect(result).toEqual([]);

      [element1, element2, decorated].forEach((element) => {
        expect(mosAttributes(element)).toEqual([]);
        expect(element.classList.contains("mos-init")).toBe(false);
        expect(element.classList.contains("mos-animate")).toBe(false);
      });
      expect(decorated.getAttribute("data-other")).toBe("keep");
      expect(decorated.classList.contains("keep")).toBe(true);

      expect(activeListeners).toEqual([]);
      expect(mos.startDomObserver).not.toHaveBeenCalled();
      expect(FakeMutationObserver.instances).toHaveLength(0);

      // Nothing happens later either
      fireStart();
      window.dispatchEvent(new Event("load"));
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(1000);

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
      expect(mos.animate).not.toHaveBeenCalled();
      expect(mos.getPreparedElements()).toEqual([]);
      expect(listenerCount(window, "scroll")).toBe(0);
    };

    /** Asserts that MOS runs normally */
    const expectEnabled = (result: HTMLElement[]) => {
      expect(result).toEqual([element1, element2, decorated]);
      expect(element1.getAttribute("data-mos")).toBe("fade");
      expect(decorated.getAttribute("data-mos-delay")).toBe("100");
      expect(listenerCount(window, "resize")).toBe(1);

      fireStart();

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(element1.classList.contains("mos-init")).toBe(true);
    };

    it("strips attributes and classes and sets nothing up for disable: true", () => {
      expectDisabled(mos.index.init({ disable: true }));
    });

    it("also disables when the document is already loaded", () => {
      setReadyState("complete");

      expectDisabled(mos.index.init({ disable: true }));
    });

    it("runs normally for disable: false", () => {
      expectEnabled(mos.index.init({ disable: false }));
    });

    it.each([
      ["phone", 500],
      ["tablet", 800],
      ["mobile", 500],
      ["mobile", 800],
    ] as const)("disables for device keyword '%s' at a viewport width of %i", (disable, width) => {
      setViewport(width);

      expectDisabled(mos.index.init({ disable }));
    });

    it.each([
      ["phone", 800],
      ["phone", 1280],
      ["tablet", 500],
      ["tablet", 1280],
      ["mobile", 1280],
    ] as const)(
      "runs normally for device keyword '%s' at a viewport width of %i",
      (disable, width) => {
        setViewport(width);

        expectEnabled(mos.index.init({ disable }));
      },
    );

    it("disables when a disable function returns true", () => {
      const disable = vi.fn(() => true);

      expectDisabled(mos.index.init({ disable }));
      expect(disable).toHaveBeenCalled();
    });

    it("runs normally when a disable function returns false", () => {
      expectEnabled(mos.index.init({ disable: () => false }));
    });

    it("strips custom init and animated class names", () => {
      decorated.classList.add("my-init", "my-animated");

      mos.index.init({ disable: true, initClassName: "my-init", animatedClassName: "my-animated" });

      expect(decorated.classList.contains("my-init")).toBe(false);
      expect(decorated.classList.contains("my-animated")).toBe(false);
      expect(decorated.classList.contains("keep")).toBe(true);
    });

    it("does not throw when the class names are disabled with false", () => {
      expect(() =>
        mos.index.init({ disable: true, initClassName: false, animatedClassName: false }),
      ).not.toThrow();
      expect(mosAttributes(decorated)).toEqual([]);
      expect(decorated.classList.contains("keep")).toBe(true);
    });

    describe("prefers-reduced-motion", () => {
      it("disables when the user prefers reduced motion", () => {
        const matchMedia = stubMatchMedia(true);

        expectDisabled(mos.index.init());
        expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
      });

      it("runs normally when the user has no reduced motion preference", () => {
        stubMatchMedia(false);

        expectEnabled(mos.index.init());
      });

      it("runs normally when matchMedia is not available", () => {
        expect((window as any).matchMedia).toBeUndefined();

        expectEnabled(mos.index.init());
      });

      it("can be opted out of with respectReducedMotion: false", () => {
        stubMatchMedia(true);

        expectEnabled(mos.index.init({ respectReducedMotion: false }));
      });

      it("still honours disable: true when respectReducedMotion is false", () => {
        stubMatchMedia(false);

        expectDisabled(mos.index.init({ respectReducedMotion: false, disable: true }));
      });
    });

    it("refreshHard() strips elements when the disable condition starts to match", () => {
      let disabled = false;
      mos.index.init({ disable: () => disabled });
      fireStart();
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);

      disabled = true;
      const added = addMosElement("zoom-in", { "data-mos-duration": "200" });
      mos.index.refreshHard();

      [element1, element2, decorated, added].forEach((element) => {
        expect(mosAttributes(element)).toEqual([]);
        expect(element.classList.contains("mos-init")).toBe(false);
        expect(element.classList.contains("mos-animate")).toBe(false);
      });
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("refreshHard() strips elements for reduced motion even before activation", () => {
      mos.index.init();
      stubMatchMedia(true);

      mos.index.refreshHard();

      expect(mosAttributes(element1)).toEqual([]);
      expect(mosAttributes(decorated)).toEqual([]);
      expect(decorated.classList.contains("mos-init")).toBe(false);
      expect(mos.prepareElements).not.toHaveBeenCalled();
    });

    // AOS evaluates `disable` on every init() call, so this also applies once MOS is active
    it("strips elements when init({ disable: true }) is called after activation", () => {
      mos.index.init();
      fireStart();

      mos.index.init({ disable: true });

      [element1, element2, decorated].forEach((element) => {
        expect(mosAttributes(element)).toEqual([]);
        expect(element.classList.contains("mos-init")).toBe(false);
      });
    });

    it("does not start animating when an init() before the start event disables MOS", () => {
      mos.index.init();
      mos.index.init({ disable: true });
      fireStart();

      expect(mos.getPreparedElements()).toEqual([]);
      expect(mos.animate).not.toHaveBeenCalled();
      expect(element1.classList.contains("mos-init")).toBe(false);
    });
  });

  // ===================================================================
  // DISABLING AFTER ACTIVATION
  // ===================================================================

  describe("disabling after activation", () => {
    type Controls = {
      play: ReturnType<typeof vi.fn>;
      complete: ReturnType<typeof vi.fn>;
      cancel: ReturnType<typeof vi.fn>;
      speed: number;
    };

    /** Controls of a tracked element, with the speed recorded at every complete() call */
    function watchControls(element: HTMLElement): { controls: Controls; speeds: number[] } {
      const tracked = mos.getPreparedElements().find((mosEl) => mosEl.element === element)!;
      const controls = tracked.controls as unknown as Controls;
      const speeds: number[] = [];
      controls.complete.mockImplementation(() => {
        speeds.push(controls.speed);
      });
      return { controls, speeds };
    }

    const expectTornDown = () => {
      expect(activeListeners).toEqual([]);
      expect(mos.getPreparedElements()).toEqual([]);
      expect(FakeMutationObserver.instances.every((observer) => !observer.connected)).toBe(true);
      [element1, element2].forEach((element) => {
        expect(mosAttributes(element)).toEqual([]);
        expect(element.className).toBe("");
      });
    };

    it("completes every tracked animation forwards on init({ disable: true })", () => {
      mos.index.init();
      fireStart();
      const first = watchControls(element1);
      const second = watchControls(element2);
      // one element is part-way through animating out
      second.controls.speed = -1;

      const result = mos.index.init({ disable: true });

      expect(result).toEqual([]);
      expect(first.speeds).toEqual([1]);
      expect(second.speeds).toEqual([1]);
      expect(second.controls.speed).toBe(1);
      expectTornDown();
    });

    it("completes every tracked animation forwards when refreshHard() finds MOS disabled", () => {
      let disabled = false;
      mos.index.init({ disable: () => disabled });
      fireStart();
      const first = watchControls(element1);
      first.controls.speed = -1;

      disabled = true;
      mos.index.refreshHard();

      expect(first.speeds).toEqual([1]);
      expectTornDown();
    });

    it("completes every tracked animation forwards when reduced motion starts to apply", () => {
      mos.index.init();
      fireStart();
      const first = watchControls(element1);
      first.controls.speed = -1;

      stubMatchMedia(true);
      mos.index.refreshHard();

      expect(first.speeds).toEqual([1]);
      expectTornDown();
    });

    it("cancels a pending delayed show instead of playing it later", () => {
      const delayed = addMosElement("fade", { "data-mos-delay": "500" });
      mos.index.init();
      fireStart();
      const { controls, speeds } = watchControls(delayed);
      expect(delayed.classList.contains("mos-animate")).toBe(true);
      expect(controls.play).not.toHaveBeenCalled();

      mos.index.init({ disable: true });
      vi.advanceTimersByTime(10_000);

      expect(controls.play).not.toHaveBeenCalled();
      expect(speeds).toEqual([1]);
      expect(mosAttributes(delayed)).toEqual([]);
      expect(delayed.className).toBe("");
    });

    it("stops reacting to scroll, resize, load and the start event afterwards", () => {
      mos.index.init();
      fireStart();
      mos.index.init({ disable: true });
      const prepared = mos.prepareElements.mock.calls.length;
      const evaluated = mos.evaluateElementPositions.mock.calls.length;
      const animated = mos.animate.mock.calls.length;

      fireStart();
      window.dispatchEvent(new Event("load"));
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(1000);
      mos.index.refresh();

      expect(mos.prepareElements).toHaveBeenCalledTimes(prepared);
      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(evaluated);
      expect(mos.animate).toHaveBeenCalledTimes(animated);
      expect(listenerCount(window, "scroll")).toBe(0);
    });

    it("does not throw for tracked elements that have no controls", () => {
      mos.index.init();
      fireStart();
      mos.getPreparedElements().forEach((mosEl) => {
        mosEl.controls = undefined;
      });

      expect(() => mos.index.init({ disable: true })).not.toThrow();
      expectTornDown();
    });
  });

  // ===================================================================
  // REFRESH ON WINDOW LOAD
  // ===================================================================
  // Like AOS: positions calculated at DOMContentLoaded are stale once images
  // have loaded, so MOS refreshes once more on the window load event.

  describe("refresh on window load", () => {
    const fireLoad = (): void => {
      window.dispatchEvent(new Event("load"));
    };

    it("listens once for window load when starting on DOMContentLoaded before the page loaded", () => {
      mos.index.init();

      expect(listenerCount(window, "load")).toBe(1);
    });

    it("refreshes the tracked elements when the window load event fires after the start", () => {
      mos.index.init();
      fireStart();
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(1);

      fireLoad();

      expect(mos.prepareElements).toHaveBeenCalledTimes(2);
      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(2);
      expect(lastElements()).toEqual([element1, element2]);
    });

    it("keeps the state and controls of tracked elements on the load refresh", () => {
      mos.index.init();
      fireStart();
      const before = mos.getPreparedElements().map((mosEl) => [mosEl.animated, mosEl.controls]);
      const animateCalls = mos.animate.mock.calls.length;

      fireLoad();

      const after = mos.getPreparedElements().map((mosEl) => [mosEl.animated, mosEl.controls]);
      expect(after).toEqual(before);
      after.forEach(([, controls], index) => expect(controls).toBe(before[index][1]));
      expect(mos.animate).toHaveBeenCalledTimes(animateCalls);
    });

    it("refreshes only for the first load event", () => {
      mos.index.init();
      fireStart();

      fireLoad();
      fireLoad();
      fireLoad();

      expect(mos.prepareElements).toHaveBeenCalledTimes(2);
    });

    it("also listens when the start happened immediately (readyState interactive)", () => {
      setReadyState("interactive");

      mos.index.init();

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(listenerCount(window, "load")).toBe(1);

      fireLoad();
      expect(mos.prepareElements).toHaveBeenCalledTimes(2);
    });

    it("does not listen when the page has already loaded", () => {
      setReadyState("complete");

      mos.index.init();

      expect(listenerCount(window, "load")).toBe(0);
      fireLoad();
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("does not listen when the page has already loaded and a custom start event is used", () => {
      setReadyState("complete");

      mos.index.init({ startEvent: "my-app:ready" });

      expect(listenerCount(window, "load")).toBe(0);
    });

    it("adds no second load listener when startEvent is 'load'", () => {
      mos.index.init({ startEvent: "load" });

      expect(listenerCount(window, "load")).toBe(1);

      fireLoad();
      // started once, not started and refreshed
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(1);
    });

    it("does not activate the library when load fires before a custom start event", () => {
      mos.index.init({ startEvent: "my-app:ready" });
      expect(listenerCount(window, "load")).toBe(1);

      fireLoad();

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
      expect(mos.animate).not.toHaveBeenCalled();
      expect(mos.getPreparedElements()).toEqual([]);
      expect(listenerCount(window, "scroll")).toBe(0);
      expect(element1.classList.contains("mos-init")).toBe(false);

      // layout changes are still ignored, and the real start event still works
      mos.index.handleLayoutChange();
      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();

      document.dispatchEvent(new Event("my-app:ready"));
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("does not activate the library when load fires before DOMContentLoaded", () => {
      mos.index.init();

      fireLoad();

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(mos.getPreparedElements()).toEqual([]);
    });

    it("replaces the load listener instead of adding one when init() is called twice before start", () => {
      mos.index.init();
      mos.index.init({ duration: 500 });
      mos.index.init();

      expect(listenerCount(window, "load")).toBe(1);

      fireStart();
      fireLoad();

      // one start and exactly one load refresh
      expect(mos.prepareElements).toHaveBeenCalledTimes(2);
    });

    it("leaves a single load listener when a second init() switches startEvent to 'load'", () => {
      mos.index.init();
      mos.index.init({ startEvent: "load" });

      expect(listenerCount(window, "load")).toBe(1);
      expect(listenerCount(document, "DOMContentLoaded")).toBe(0);

      fireLoad();
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("adds the load listener when a second init() switches startEvent away from 'load'", () => {
      mos.index.init({ startEvent: "load" });
      mos.index.init({ startEvent: "my-app:ready" });

      expect(listenerCount(window, "load")).toBe(1);

      fireLoad();
      expect(mos.prepareElements).not.toHaveBeenCalled();

      document.dispatchEvent(new Event("my-app:ready"));
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
    });

    it("adds no further load listener when init() is called again after activation", () => {
      mos.index.init();
      fireStart();
      mos.index.init({ duration: 500 });
      mos.index.init();
      const prepared = mos.prepareElements.mock.calls.length;

      expect(listenerCount(window, "load")).toBe(1);

      fireLoad();
      expect(mos.prepareElements).toHaveBeenCalledTimes(prepared + 1);
    });

    it("is removed by destroy() before the start", () => {
      mos.index.init();

      mos.index.destroy();

      expect(listenerCount(window, "load")).toBe(0);
      fireLoad();
      expect(mos.prepareElements).not.toHaveBeenCalled();
    });

    it("is removed by destroy() after the start", () => {
      mos.index.init();
      fireStart();

      mos.index.destroy();

      expect(listenerCount(window, "load")).toBe(0);
      fireLoad();
      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(mos.getPreparedElements()).toEqual([]);
    });

    it("is removed when a later init() disables MOS", () => {
      mos.index.init();
      mos.index.init({ disable: true });

      expect(listenerCount(window, "load")).toBe(0);
      fireLoad();
      expect(mos.prepareElements).not.toHaveBeenCalled();
    });

    it("is not added when MOS is disabled from the start", () => {
      mos.index.init({ disable: true });

      expect(listenerCount(window, "load")).toBe(0);
    });
  });

  // ===================================================================
  // refresh()
  // ===================================================================

  describe("refresh()", () => {
    it("is a no-op before init()", () => {
      mos.index.refresh();

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
      expect(listenerCount(window, "scroll")).toBe(0);
    });

    it("is a no-op between init() and the start event", () => {
      mos.index.init();
      mos.index.refresh();

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(mos.updateScrollHandlerDelays).not.toHaveBeenCalled();
      expect(mos.ensureScrollHandlerActive).not.toHaveBeenCalled();
      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
      expect(mos.getPreparedElements()).toEqual([]);
    });

    it("re-prepares the tracked elements with the current options after activation", () => {
      mos.index.init({ duration: 800, delay: 200 });
      fireStart();

      mos.index.refresh();

      expect(mos.prepareElements).toHaveBeenCalledTimes(2);
      expect(lastElements()).toEqual([element1, element2]);
      expect(lastOptions()).toEqual({ ...DEFAULT_OPTIONS, duration: 800, delay: 200 });
      expect(mos.evaluateElementPositions).toHaveBeenCalledTimes(2);
    });

    it("does not pick up elements added to the DOM after activation", () => {
      mos.index.init();
      fireStart();
      const added = addMosElement("zoom-in");

      mos.index.refresh();

      expect(lastElements()).toEqual([element1, element2]);
      expect(mos.getPreparedElements().map((mosEl) => mosEl.element)).not.toContain(added);
    });

    it("keeps the animated state and controls of tracked elements", () => {
      mos.index.init();
      fireStart();
      const before = mos.getPreparedElements().map(({ animated, controls }) => ({
        animated,
        controls,
      }));
      const animateCalls = mos.animate.mock.calls.length;

      mos.index.refresh();

      const after = mos.getPreparedElements();
      expect(after).toHaveLength(before.length);
      after.forEach((mosEl, index) => {
        expect(mosEl.animated).toBe(before[index]!.animated);
        expect(mosEl.controls).toBe(before[index]!.controls);
      });
      expect(mos.animate.mock.calls.length).toBe(animateCalls);
    });

    it("keeps a single scroll listener across refreshes", () => {
      mos.index.init();
      fireStart();
      mos.index.refresh();
      mos.index.refresh();

      expect(listenerCount(window, "scroll")).toBe(1);
    });
  });

  // ===================================================================
  // refreshHard()
  // ===================================================================

  describe("refreshHard()", () => {
    it("does not prepare anything before activation", () => {
      mos.index.init();
      mos.index.refreshHard();

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
      expect(mos.getPreparedElements()).toEqual([]);
      // not disabled, so the elements are left alone
      expect(element1.getAttribute("data-mos")).toBe("fade");
    });

    it("does not prepare anything before init()", () => {
      mos.index.refreshHard();

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(listenerCount(window, "scroll")).toBe(0);
    });

    it("passes freshly queried elements, including ones added since activation", () => {
      mos.index.init({ offset: 33 });
      fireStart();
      const added = addMosElement("zoom-in");

      mos.index.refreshHard();

      expect(mos.getMosElements).toHaveBeenLastCalledWith(true);
      expect(mos.prepareElements).toHaveBeenCalledTimes(2);
      expect(lastElements()).toEqual([element1, element2, added]);
      expect(lastOptions()).toEqual({ ...DEFAULT_OPTIONS, offset: 33 });
      expect(mos.getPreparedElements().map((mosEl) => mosEl.element)).toEqual([
        element1,
        element2,
        added,
      ]);
      expect(added.classList.contains("mos-init")).toBe(true);
    });

    it("stops tracking elements that were removed from the DOM", () => {
      mos.index.init();
      fireStart();
      element1.remove();

      mos.index.refreshHard();

      expect(lastElements()).toEqual([element2]);
      expect(mos.getPreparedElements().map((mosEl) => mosEl.element)).toEqual([element2]);
    });

    it("does not clear the existing state or tear down the scroll handler", () => {
      mos.index.init();
      fireStart();
      addMosElement("zoom-in");

      mos.index.refreshHard();

      expect(mos.clearAllElements).not.toHaveBeenCalled();
      expect(mos.cleanupScrollHandler).not.toHaveBeenCalled();
      expect(listenerCount(window, "scroll")).toBe(1);
    });

    it("keeps animated state and controls of already tracked elements (no replay)", () => {
      const outEvents = vi.fn();
      const inEvents = vi.fn();
      mos.index.init({ once: true });
      fireStart();

      // Mark the first element as shown with a known animation
      const tracked = mos.getPreparedElements()[0]!;
      const controls = {
        play: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
        complete: vi.fn(),
        cancel: vi.fn(),
        speed: 1,
        time: 0,
      };
      tracked.animated = true;
      tracked.controls = controls as any;

      document.addEventListener("mos:in", inEvents);
      document.addEventListener("mos:out", outEvents);
      const animateCalls = mos.animate.mock.calls.length;
      const added = addMosElement("zoom-in");

      mos.index.refreshHard();

      const after = mos.getPreparedElements().find((mosEl) => mosEl.element === element1)!;
      expect(after.animated).toBe(true);
      expect(after.controls).toBe(controls);
      expect(controls.cancel).not.toHaveBeenCalled();
      expect(controls.pause).not.toHaveBeenCalled();
      expect(controls.play).not.toHaveBeenCalled();
      expect(outEvents).not.toHaveBeenCalled();
      inEvents.mock.calls.forEach(([event]) => {
        expect((event as CustomEvent).detail).not.toBe(element1);
      });

      // Only the new element needed an animation
      const newCalls = mos.animate.mock.calls.slice(animateCalls);
      newCalls.forEach((call) => expect((call as any[])[0]).toBe(added));

      document.removeEventListener("mos:in", inEvents);
      document.removeEventListener("mos:out", outEvents);
    });
  });

  // ===================================================================
  // destroy()
  // ===================================================================

  describe("destroy()", () => {
    it("is safe to call before init()", () => {
      expect(() => mos.index.destroy()).not.toThrow();
      expect(activeListeners).toEqual([]);
    });

    it("is safe to call twice", () => {
      mos.index.init();
      fireStart();

      mos.index.destroy();

      expect(() => mos.index.destroy()).not.toThrow();
      expect(listenerCount(window, "resize")).toBe(0);
      expect(listenerCount(window, "scroll")).toBe(0);
    });

    it("removes the resize, orientationchange and scroll listeners", () => {
      mos.index.init();
      fireStart();
      expect(listenerCount(window, "resize")).toBe(1);
      expect(listenerCount(window, "orientationchange")).toBe(1);
      expect(listenerCount(window, "scroll")).toBe(1);

      mos.index.destroy();

      expect(listenerCount(window, "resize")).toBe(0);
      expect(listenerCount(window, "orientationchange")).toBe(0);
      expect(listenerCount(window, "scroll")).toBe(0);
      expect(mos.cleanupScrollHandler).toHaveBeenCalled();
    });

    it("stops reacting to layout changes and scrolling", () => {
      mos.index.init();
      fireStart();
      mos.index.destroy();
      mos.evaluateElementPositions.mockClear();
      mos.animate.mockClear();

      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("orientationchange"));
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(1000);

      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
      expect(mos.animate).not.toHaveBeenCalled();
    });

    it("drops a resize that was already debounced when destroy() is called", () => {
      mos.index.init();
      fireStart();
      mos.evaluateElementPositions.mockClear();

      window.dispatchEvent(new Event("resize"));
      mos.index.destroy();
      vi.advanceTimersByTime(1000);

      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
    });

    it("removes a pending start listener", () => {
      mos.index.init();
      expect(listenerCount(document, "DOMContentLoaded")).toBe(1);

      mos.index.destroy();

      expect(listenerCount(document, "DOMContentLoaded")).toBe(0);
      fireStart();
      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(listenerCount(window, "scroll")).toBe(0);
    });

    it("removes a pending start listener for the load event and custom events", () => {
      mos.index.init({ startEvent: "load" });
      mos.index.destroy();
      expect(listenerCount(window, "load")).toBe(0);

      mos.index.init({ startEvent: "my-app:ready" });
      mos.index.destroy();
      expect(listenerCount(document, "my-app:ready")).toBe(0);

      window.dispatchEvent(new Event("load"));
      document.dispatchEvent(new Event("my-app:ready"));
      expect(mos.prepareElements).not.toHaveBeenCalled();
    });

    it("cancels pending delayed shows", () => {
      const delayed = addMosElement("fade", { "data-mos-delay": "500" });
      mos.index.init();
      fireStart();
      const controls = mos.getPreparedElements().find((mosEl) => mosEl.element === delayed)!
        .controls as any;
      expect(controls.play).not.toHaveBeenCalled();

      mos.index.destroy();
      vi.advanceTimersByTime(10_000);

      expect(controls.play).not.toHaveBeenCalled();
      expect(controls.complete).not.toHaveBeenCalled();
      // the element keeps the state it is in
      expect(delayed.classList.contains("mos-animate")).toBe(true);
    });

    it("stops the DOM observer", () => {
      mos.index.init();
      const observer = FakeMutationObserver.instances[0]!;
      expect(observer.connected).toBe(true);

      mos.index.destroy();

      expect(mos.stopDomObserver).toHaveBeenCalled();
      expect(observer.disconnect).toHaveBeenCalled();
      expect(observer.connected).toBe(false);
    });

    it("forgets all tracked elements", () => {
      mos.index.init();
      fireStart();
      expect(mos.getPreparedElements()).toHaveLength(2);

      mos.index.destroy();

      expect(mos.getPreparedElements()).toEqual([]);
    });

    it("leaves the elements' attributes and classes alone", () => {
      mos.index.init();
      fireStart();
      const classes = element1.className;

      mos.index.destroy();

      expect(element1.getAttribute("data-mos")).toBe("fade");
      expect(element1.className).toBe(classes);
    });

    it("deactivates the library so refresh(), refreshHard() and layout changes are no-ops", () => {
      mos.index.init();
      fireStart();
      mos.index.destroy();
      mos.prepareElements.mockClear();
      mos.evaluateElementPositions.mockClear();

      mos.index.refresh();
      mos.index.refreshHard();
      mos.index.handleLayoutChange();

      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(mos.evaluateElementPositions).not.toHaveBeenCalled();
      expect(listenerCount(window, "scroll")).toBe(0);
    });

    it("resets accumulated options so a following init() sees the defaults again", () => {
      mos.index.init({ duration: 900, timeUnits: "s", once: true, offset: 5, easing: "linear" });
      fireStart();
      expect(lastOptions().duration).toBe(900);

      mos.index.destroy();
      mos.index.init();
      fireStart();

      expect(lastOptions()).toEqual(DEFAULT_OPTIONS);
    });

    it("forgets a disable option from before destroy()", () => {
      const spare = addMosElement("fade");
      mos.index.init({ respectReducedMotion: false, startEvent: "my-app:ready" });
      mos.index.destroy();
      stubMatchMedia(true);

      // respectReducedMotion is back to its default (true)
      expect(mos.index.init()).toEqual([]);
      expect(mosAttributes(spare)).toEqual([]);
      expect(listenerCount(document, "my-app:ready")).toBe(0);
    });

    it("lets a later init() start from scratch", () => {
      mos.index.init();
      fireStart();
      mos.index.destroy();
      mos.prepareElements.mockClear();

      const result = mos.index.init({ duration: 250 });

      // back to waiting for the start event
      expect(result).toEqual([element1, element2]);
      expect(mos.prepareElements).not.toHaveBeenCalled();
      expect(listenerCount(window, "resize")).toBe(1);
      expect(listenerCount(window, "orientationchange")).toBe(1);
      expect(listenerCount(document, "DOMContentLoaded")).toBe(1);
      expect(FakeMutationObserver.instances.filter((instance) => instance.connected)).toHaveLength(
        1,
      );

      fireStart();

      expect(mos.prepareElements).toHaveBeenCalledTimes(1);
      expect(lastOptions()).toEqual({ ...DEFAULT_OPTIONS, duration: 250 });
      expect(listenerCount(window, "scroll")).toBe(1);
      expect(mos.getPreparedElements()).toHaveLength(2);
    });

    it("is available on the MOS object", () => {
      mos.index.MOS.init();
      fireStart();

      mos.index.MOS.destroy();

      expect(listenerCount(window, "resize")).toBe(0);
      expect(mos.getPreparedElements()).toEqual([]);
    });
  });
});
