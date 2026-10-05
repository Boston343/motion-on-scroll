import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// ===================================================================
// LIFECYCLE INTEGRATION TEST
// ===================================================================
// Drives the real library through its public entry point. No helper module
// is mocked: only `motion` is (globally, in vitest.setup.ts), and its
// `animate` is given an implementation here that returns a fresh controls
// object per call so animations can be counted per element.
//
// jsdom has no layout, so elements are placed by stubbing their offsets and
// the page is "scrolled" by stubbing window.scrollY and dispatching real
// scroll events (with fake timers, because the scroll handler is throttled).

type MosModule = typeof import("../index.js");

type FakeControls = {
  play: Mock;
  pause: Mock;
  stop: Mock;
  complete: Mock;
  cancel: Mock;
  speed: number;
  time: number;
  finished: Promise<void>;
};

type MosEventRecord = { type: string; detail: unknown };

const WINDOW_HEIGHT = 1000;
const OFFSET = 120; // DEFAULT_OPTIONS.offset
const EASE = [0.25, 0.1, 0.25, 1]; // DEFAULT_OPTIONS.easing ("ease")

let MOS: MosModule;
let animateMock: Mock;

/** Every controls object created for an element, in creation order */
let controlsByElement: Map<Element, FakeControls[]>;

/** Every mos:* event dispatched on the document, in order */
let events: MosEventRecord[];
let stopRecordingEvents: () => void;

// ===================================================================
// TEST HELPERS
// ===================================================================

/**
 * Loads a fresh copy of the library (and of the `motion` mock it uses)
 */
async function loadLibrary(): Promise<void> {
  vi.resetModules();

  const motion = await import("motion");
  animateMock = vi.mocked(motion.animate) as unknown as Mock;
  animateMock.mockImplementation((element: Element): FakeControls => {
    const controls: FakeControls = {
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn(),
      speed: 1,
      time: 0,
      finished: Promise.resolve(),
    };
    const list = controlsByElement.get(element) ?? [];
    list.push(controls);
    controlsByElement.set(element, list);
    return controls;
  });

  MOS = await import("../index.js");
}

/**
 * Gives an element a fake layout position (document coordinates)
 */
function place(element: HTMLElement, top: number, height = 100): void {
  Object.defineProperty(element, "offsetTop", { value: top, configurable: true });
  Object.defineProperty(element, "offsetHeight", { value: height, configurable: true });
  Object.defineProperty(element, "offsetParent", { value: null, configurable: true });
}

/**
 * Creates a `[data-mos]` element at the given position (not yet in the DOM)
 */
function createMosElement(
  top: number,
  attributes: Record<string, string> = {},
  animation = "fade-up",
): HTMLElement {
  const element = document.createElement("div");
  element.setAttribute("data-mos", animation);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  place(element, top);
  return element;
}

/**
 * Creates a `[data-mos]` element and appends it to the body
 */
function addMosElement(
  top: number,
  attributes: Record<string, string> = {},
  animation = "fade-up",
): HTMLElement {
  const element = createMosElement(top, attributes, animation);
  document.body.appendChild(element);
  return element;
}

/** Scroll position at which an element placed at `top` starts animating in */
function positionIn(top: number): number {
  return top - WINDOW_HEIGHT + OFFSET;
}

/** Scroll position at which a mirror element placed at `top` animates out again */
function positionOut(top: number, height = 100): number {
  return top + height - OFFSET;
}

function setScrollY(value: number): void {
  Object.defineProperty(window, "scrollY", { value, writable: true, configurable: true });
}

/**
 * Scrolls the page: sets scrollY, dispatches a real scroll event and lets the throttle settle
 */
function scrollTo(value: number): void {
  setScrollY(value);
  window.dispatchEvent(new Event("scroll"));
  vi.advanceTimersByTime(200);
}

/**
 * Fires a resize and waits for the debounced handler
 */
function resize(): void {
  window.dispatchEvent(new Event("resize"));
  vi.advanceTimersByTime(200);
}

/**
 * Lets MutationObserver callbacks (delivered as microtasks) run
 */
async function flushMutations(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
}

/** All controls ever created for an element */
function allControls(element: Element): FakeControls[] {
  return controlsByElement.get(element) ?? [];
}

/** Number of animate() calls made for an element */
function animateCount(element: Element): number {
  return animateMock.mock.calls.filter(([target]) => target === element).length;
}

/** The single controls object of an element (fails if it was animated more than once) */
function onlyControls(element: Element): FakeControls {
  const list = allControls(element);
  expect(list).toHaveLength(1);
  expect(animateCount(element)).toBe(1);
  return list[0];
}

/** Call counts and playback direction of a controls object, for before/after comparison */
function snapshot(controls: FakeControls) {
  return {
    play: controls.play.mock.calls.length,
    pause: controls.pause.mock.calls.length,
    stop: controls.stop.mock.calls.length,
    complete: controls.complete.mock.calls.length,
    cancel: controls.cancel.mock.calls.length,
    speed: controls.speed,
  };
}

function eventsOfType(type: string, element?: Element): MosEventRecord[] {
  return events.filter(
    (event) => event.type === type && (element === undefined || event.detail === element),
  );
}

function isShown(element: Element): boolean {
  return element.classList.contains("mos-animate");
}

/**
 * Records the given event types dispatched on the document
 */
function recordEvents(types: string[]): () => void {
  const listener = (event: Event): void => {
    events.push({ type: event.type, detail: (event as CustomEvent).detail });
  };
  types.forEach((type) => document.addEventListener(type, listener));
  return () => types.forEach((type) => document.removeEventListener(type, listener));
}

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, "readyState", { value: state, configurable: true });
}

function restoreReadyState(): void {
  delete (document as unknown as Record<string, unknown>).readyState;
}

/** Records the playback speed at the moment complete() is called */
function recordSpeedAtComplete(controls: FakeControls): number[] {
  const speeds: number[] = [];
  controls.complete.mockImplementation(() => {
    speeds.push(controls.speed);
  });
  return speeds;
}

describe("MOS lifecycle (integration)", () => {
  beforeEach(async () => {
    vi.useFakeTimers();

    document.body.innerHTML = "";
    document.body.className = "";
    Object.defineProperty(window, "innerHeight", { value: WINDOW_HEIGHT, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    setScrollY(0);

    controlsByElement = new Map();
    events = [];
    stopRecordingEvents = recordEvents([
      "mos:in",
      "mos:out",
      "mos:in:hero",
      "mos:out:hero",
      "mos:in:other",
      "mos:out:other",
    ]);

    await loadLibrary();
  });

  afterEach(async () => {
    MOS.destroy();
    stopRecordingEvents();
    document.body.innerHTML = "";
    await flushMutations();
    vi.useRealTimers();
  });

  // ===================================================================
  // (a) SHOW ON INIT / SCROLL DOWN / HIDE ON SCROLL UP
  // ===================================================================

  describe("initial state and scrolling", () => {
    it("should animate in elements that are in view right after init, and only those", () => {
      const inView = addMosElement(100);
      const alsoInView = addMosElement(600);
      const below = addMosElement(2000);

      const returned = MOS.init();

      expect(returned).toEqual([inView, alsoInView, below]);

      // Every tracked element gets the init class and exactly one animation
      [inView, alsoInView, below].forEach((element) => {
        expect(element.classList.contains("mos-init")).toBe(true);
        expect(animateCount(element)).toBe(1);
      });

      // In view: played forwards once
      [inView, alsoInView].forEach((element) => {
        const controls = onlyControls(element);
        expect(isShown(element)).toBe(true);
        expect(controls.play).toHaveBeenCalledTimes(1);
        expect(controls.speed).toBe(1);
        expect(controls.complete).not.toHaveBeenCalled();
        expect(controls.cancel).not.toHaveBeenCalled();
      });

      // Below: created, paused at its start, never played
      const belowControls = onlyControls(below);
      expect(isShown(below)).toBe(false);
      expect(belowControls.pause).toHaveBeenCalledTimes(1);
      expect(belowControls.play).not.toHaveBeenCalled();
      expect(belowControls.complete).not.toHaveBeenCalled();
    });

    it("should create the animation with duration and ease only, never handing the delay to motion", () => {
      const element = addMosElement(100, {
        "data-mos-duration": "600",
        "data-mos-delay": "150",
        "data-mos-easing": "linear",
      });
      const plain = addMosElement(200);

      MOS.init();

      expect(animateMock).toHaveBeenCalledTimes(2);
      expect(animateMock.mock.calls[0][0]).toBe(element);
      expect(animateMock.mock.calls[0][1]).toEqual({ opacity: [0, 1], translateY: [100, 0] });
      expect(animateMock.mock.calls[0][2]).toEqual({
        duration: 0.6,
        ease: "linear",
        autoplay: false,
      });
      expect(animateMock.mock.calls[1][0]).toBe(plain);
      expect(animateMock.mock.calls[1][2]).toEqual({ duration: 0.4, ease: EASE, autoplay: false });
    });

    it("should show an element exactly when the scroll position reaches its trigger", () => {
      const below = addMosElement(2000);
      MOS.init();
      const controls = onlyControls(below);

      scrollTo(positionIn(2000) - 1);
      expect(isShown(below)).toBe(false);
      expect(controls.play).not.toHaveBeenCalled();

      scrollTo(positionIn(2000));
      expect(isShown(below)).toBe(true);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.speed).toBe(1);
      expect(animateCount(below)).toBe(1);
    });

    it("should show elements when scrolling down and hide them when scrolling back up", () => {
      const inView = addMosElement(100);
      const below = addMosElement(2000);
      const farBelow = addMosElement(4000);
      MOS.init();

      const inViewControls = onlyControls(inView);
      const belowControls = onlyControls(below);
      const farBelowControls = onlyControls(farBelow);

      // Scroll down until `below` is in view
      scrollTo(1500);
      expect(isShown(below)).toBe(true);
      expect(belowControls.play).toHaveBeenCalledTimes(1);
      expect(belowControls.speed).toBe(1);
      expect(isShown(farBelow)).toBe(false);
      expect(farBelowControls.play).not.toHaveBeenCalled();

      // More scrolling within the shown range changes nothing
      scrollTo(1600);
      scrollTo(1700);
      expect(belowControls.play).toHaveBeenCalledTimes(1);
      expect(inViewControls.play).toHaveBeenCalledTimes(1);

      // Scroll back to the top: `below` animates out (same animation, reversed)
      scrollTo(0);
      expect(isShown(below)).toBe(false);
      expect(below.classList.contains("mos-init")).toBe(true);
      expect(belowControls.play).toHaveBeenCalledTimes(2);
      expect(belowControls.speed).toBe(-1);
      expect(belowControls.pause).toHaveBeenCalledTimes(1); // only the initial pause
      expect(belowControls.cancel).not.toHaveBeenCalled();

      // The element at the top of the page is still in view and untouched
      expect(isShown(inView)).toBe(true);
      expect(inViewControls.play).toHaveBeenCalledTimes(1);
      expect(inViewControls.speed).toBe(1);

      // And down again: plays forwards again, still the one animation
      scrollTo(1500);
      expect(isShown(below)).toBe(true);
      expect(belowControls.play).toHaveBeenCalledTimes(3);
      expect(belowControls.speed).toBe(1);

      [inView, below, farBelow].forEach((element) => expect(animateCount(element)).toBe(1));
    });

    it("should apply the last scroll position when events arrive faster than the throttle", () => {
      const below = addMosElement(2000);
      MOS.init();
      const controls = onlyControls(below);
      vi.advanceTimersByTime(500);

      // Down and straight back up within the throttle window
      setScrollY(1500);
      window.dispatchEvent(new Event("scroll"));
      setScrollY(0);
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));

      vi.advanceTimersByTime(500);

      expect(isShown(below)).toBe(false);
      expect(controls.play.mock.calls.length % 2).toBe(0); // every play was followed by a reverse
      expect(controls.play.mock.calls.length).toBeLessThanOrEqual(2);
      expect(animateCount(below)).toBe(1);
    });

    it("should put elements above the viewport straight into their final state on load", () => {
      const above = addMosElement(100);
      const inView = addMosElement(5200);
      setScrollY(5000);

      MOS.init();

      const aboveControls = onlyControls(above);
      expect(isShown(above)).toBe(true);
      expect(aboveControls.complete).toHaveBeenCalledTimes(1);
      expect(aboveControls.play).not.toHaveBeenCalled();
      expect(aboveControls.pause).not.toHaveBeenCalled();

      const inViewControls = onlyControls(inView);
      expect(isShown(inView)).toBe(true);
      expect(inViewControls.play).toHaveBeenCalledTimes(1);
      expect(inViewControls.complete).not.toHaveBeenCalled();
    });

    it("should use custom init and animated class names", () => {
      const inView = addMosElement(100);
      const below = addMosElement(2000);

      MOS.init({ initClassName: "ready", animatedClassName: "shown" });

      expect(inView.className).toBe("ready shown");
      expect(below.className).toBe("ready");

      scrollTo(1500);
      expect(below.className).toBe("ready shown");

      scrollTo(0);
      expect(below.className).toBe("ready");
    });
  });

  // ===================================================================
  // (b) ONCE
  // ===================================================================

  describe("once", () => {
    it("should never hide a globally once element after it was shown", () => {
      const below = addMosElement(2000);
      MOS.init({ once: true });
      const controls = onlyControls(below);

      scrollTo(1500);
      expect(isShown(below)).toBe(true);
      expect(controls.play).toHaveBeenCalledTimes(1);

      scrollTo(0);
      scrollTo(5000);
      scrollTo(0);

      expect(isShown(below)).toBe(true);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.speed).toBe(1);
      expect(controls.stop).not.toHaveBeenCalled();
      expect(controls.cancel).not.toHaveBeenCalled();
      expect(animateCount(below)).toBe(1);
      expect(eventsOfType("mos:in", below)).toHaveLength(1);
      expect(eventsOfType("mos:out")).toHaveLength(0);
    });

    it("should honour data-mos-once per element", () => {
      const once = addMosElement(2000, { "data-mos-once": "true" });
      const repeat = addMosElement(2000);
      MOS.init();

      scrollTo(1500);
      expect(isShown(once)).toBe(true);
      expect(isShown(repeat)).toBe(true);

      scrollTo(0);
      expect(isShown(once)).toBe(true);
      expect(isShown(repeat)).toBe(false);
      expect(onlyControls(once).play).toHaveBeenCalledTimes(1);
      expect(onlyControls(once).speed).toBe(1);
      expect(onlyControls(repeat).play).toHaveBeenCalledTimes(2);
      expect(onlyControls(repeat).speed).toBe(-1);
    });

    it("should not hide a once element when it is scrolled past, even with mirror", () => {
      const element = addMosElement(1500, { "data-mos-once": "true", "data-mos-mirror": "true" });
      MOS.init();

      scrollTo(700);
      expect(isShown(element)).toBe(true);

      scrollTo(positionOut(1500) + 500);
      scrollTo(0);

      expect(isShown(element)).toBe(true);
      expect(onlyControls(element).play).toHaveBeenCalledTimes(1);
      expect(eventsOfType("mos:out")).toHaveLength(0);
    });
  });

  // ===================================================================
  // (c) MIRROR
  // ===================================================================

  describe("mirror", () => {
    it("should hide a mirror element once it is scrolled past and show it again on the way back", () => {
      const mirror = addMosElement(1500, { "data-mos-mirror": "true" });
      const plain = addMosElement(1500);
      MOS.init();
      const mirrorControls = onlyControls(mirror);
      const plainControls = onlyControls(plain);

      // In view
      scrollTo(700);
      expect(isShown(mirror)).toBe(true);
      expect(isShown(plain)).toBe(true);

      // Just before the out position: still shown
      scrollTo(positionOut(1500) - 1);
      expect(isShown(mirror)).toBe(true);
      expect(mirrorControls.play).toHaveBeenCalledTimes(1);

      // At the out position: mirror element animates out, the plain one stays
      scrollTo(positionOut(1500));
      expect(isShown(mirror)).toBe(false);
      expect(mirrorControls.play).toHaveBeenCalledTimes(2);
      expect(mirrorControls.speed).toBe(-1);
      expect(isShown(plain)).toBe(true);
      expect(plainControls.play).toHaveBeenCalledTimes(1);

      // Further down: nothing new
      scrollTo(4000);
      expect(isShown(mirror)).toBe(false);
      expect(mirrorControls.play).toHaveBeenCalledTimes(2);

      // Scrolling back up brings it in again
      scrollTo(700);
      expect(isShown(mirror)).toBe(true);
      expect(mirrorControls.play).toHaveBeenCalledTimes(3);
      expect(mirrorControls.speed).toBe(1);

      // And above its trigger it hides like any other element
      scrollTo(0);
      expect(isShown(mirror)).toBe(false);
      expect(isShown(plain)).toBe(false);
      expect(mirrorControls.play).toHaveBeenCalledTimes(4);
      expect(mirrorControls.speed).toBe(-1);

      expect(animateCount(mirror)).toBe(1);
      expect(animateCount(plain)).toBe(1);
      expect(eventsOfType("mos:in", mirror)).toHaveLength(2);
      expect(eventsOfType("mos:out", mirror)).toHaveLength(2);
    });

    it("should keep a mirror element that is already scrolled past on load hidden", () => {
      const mirror = addMosElement(100, { "data-mos-mirror": "true" });
      setScrollY(3000);

      MOS.init({});

      const controls = onlyControls(mirror);
      expect(isShown(mirror)).toBe(false);
      expect(controls.play).not.toHaveBeenCalled();
      expect(controls.complete).not.toHaveBeenCalled();
      expect(events).toEqual([]);

      // Scrolling back up to it shows it
      scrollTo(50);
      expect(isShown(mirror)).toBe(true);
      expect(controls.play).toHaveBeenCalledTimes(1);
    });
  });

  // ===================================================================
  // (d) KEY REGRESSION: DOM CHANGES MUST NOT RESET ANIMATED ELEMENTS
  // ===================================================================

  describe("adding elements after the page has animated in", () => {
    /**
     * A page with shown, once-shown, reversed and not-yet-shown elements
     */
    function setupPage() {
      const shown = addMosElement(100);
      const shownOnce = addMosElement(300, { "data-mos-once": "true" });
      const scrolledIn = addMosElement(1500);
      const reversed = addMosElement(2500);
      const below = addMosElement(6000);

      MOS.init({ disableMutationObserver: false });

      // Show `scrolledIn` and `reversed`, then go back up a little so `reversed` hides again
      scrollTo(2000);
      scrollTo(1000);

      expect(isShown(shown)).toBe(true);
      expect(isShown(shownOnce)).toBe(true);
      expect(isShown(scrolledIn)).toBe(true);
      expect(isShown(reversed)).toBe(false);
      expect(isShown(below)).toBe(false);

      return { shown, shownOnce, scrolledIn, reversed, below };
    }

    function snapshotAll(elements: HTMLElement[]) {
      return elements.map((element) => ({
        className: element.className,
        animations: animateCount(element),
        controls: snapshot(onlyControls(element)),
      }));
    }

    it("should not re-animate, pause or re-announce tracked elements on refreshHard()", () => {
      const page = setupPage();
      const tracked = Object.values(page);
      const before = snapshotAll(tracked);
      const controlsBefore = tracked.map((element) => onlyControls(element));
      const animateCallsBefore = animateMock.mock.calls.length;
      const eventsBefore = events.length;

      const addedInView = addMosElement(1200);
      const addedBelow = addMosElement(7000);
      MOS.refreshHard();

      // Already tracked elements are completely untouched
      expect(snapshotAll(tracked)).toEqual(before);
      tracked.forEach((element, index) => {
        expect(allControls(element)).toEqual([controlsBefore[index]]);
        expect(onlyControls(element).cancel).not.toHaveBeenCalled();
      });
      expect(isShown(page.shown)).toBe(true);
      expect(isShown(page.shownOnce)).toBe(true);
      expect(isShown(page.scrolledIn)).toBe(true);
      expect(isShown(page.reversed)).toBe(false);

      // Only the two new elements got an animation
      expect(animateMock.mock.calls.length).toBe(animateCallsBefore + 2);

      // The only new event is mos:in for the new element that is in view
      expect(events.slice(eventsBefore)).toEqual([{ type: "mos:in", detail: addedInView }]);

      // The new elements are tracked
      expect(addedInView.className).toBe("mos-init mos-animate");
      expect(onlyControls(addedInView).play).toHaveBeenCalledTimes(1);
      expect(addedBelow.className).toBe("mos-init");
      expect(onlyControls(addedBelow).pause).toHaveBeenCalledTimes(1);
      expect(onlyControls(addedBelow).play).not.toHaveBeenCalled();

      // ...and keep reacting to scroll like everything else
      scrollTo(6500);
      expect(isShown(addedBelow)).toBe(true);
      expect(onlyControls(addedBelow).play).toHaveBeenCalledTimes(1);
      expect(isShown(page.below)).toBe(true);
      expect(animateMock.mock.calls.length).toBe(animateCallsBefore + 2);
    });

    it("should not re-animate, pause or re-announce tracked elements when the MutationObserver fires", async () => {
      const page = setupPage();
      const tracked = Object.values(page);
      const before = snapshotAll(tracked);
      const animateCallsBefore = animateMock.mock.calls.length;
      const eventsBefore = events.length;

      // No manual refresh: the real MutationObserver has to pick these up
      const addedInView = addMosElement(1200);
      const wrapper = document.createElement("section");
      const addedNested = createMosElement(7000);
      wrapper.appendChild(addedNested);
      document.body.appendChild(wrapper);
      await flushMutations();

      expect(snapshotAll(tracked)).toEqual(before);
      expect(animateMock.mock.calls.length).toBe(animateCallsBefore + 2);
      expect(events.slice(eventsBefore)).toEqual([{ type: "mos:in", detail: addedInView }]);

      expect(addedInView.className).toBe("mos-init mos-animate");
      expect(onlyControls(addedInView).play).toHaveBeenCalledTimes(1);
      expect(addedNested.className).toBe("mos-init");
      expect(onlyControls(addedNested).play).not.toHaveBeenCalled();

      scrollTo(6500);
      expect(isShown(addedNested)).toBe(true);
      expect(onlyControls(addedNested).play).toHaveBeenCalledTimes(1);
    });

    it("should survive many DOM changes in a row without touching tracked elements", async () => {
      const page = setupPage();
      const tracked = Object.values(page);
      const before = snapshotAll(tracked);
      const eventsBefore = events.length;

      const added: HTMLElement[] = [];
      for (let i = 0; i < 5; i++) {
        added.push(addMosElement(8000 + i * 200));
        await flushMutations();
        MOS.refreshHard();
        MOS.refresh();
      }

      expect(snapshotAll(tracked)).toEqual(before);
      expect(events.slice(eventsBefore)).toEqual([]);
      added.forEach((element) => {
        expect(animateCount(element)).toBe(1);
        expect(onlyControls(element).pause).toHaveBeenCalledTimes(1);
        expect(element.className).toBe("mos-init");
      });
    });

    it("should ignore DOM changes that do not involve data-mos elements", async () => {
      const page = setupPage();
      const tracked = Object.values(page);
      const before = snapshotAll(tracked);
      const eventsBefore = events.length;

      // Move a tracked element's layout without telling MOS, then add unrelated content
      place(page.below, 1200);
      document.body.appendChild(document.createElement("p"));
      await flushMutations();

      // No refresh happened, so the stale position is still in use
      expect(snapshotAll(tracked)).toEqual(before);
      expect(events.slice(eventsBefore)).toEqual([]);
      expect(isShown(page.below)).toBe(false);
    });

    it("should not start tracking added elements when the MutationObserver is disabled", async () => {
      MOS.destroy();
      await loadLibrary();
      const shown = addMosElement(100);
      MOS.init({ disableMutationObserver: true });

      const added = addMosElement(200);
      await flushMutations();

      expect(animateCount(added)).toBe(0);
      expect(added.className).toBe("");
      expect(onlyControls(shown).play).toHaveBeenCalledTimes(1);

      // A manual refreshHard() picks it up without touching the shown element
      MOS.refreshHard();
      expect(added.className).toBe("mos-init mos-animate");
      expect(snapshot(onlyControls(shown))).toEqual({
        play: 1,
        pause: 1,
        stop: 0,
        complete: 0,
        cancel: 0,
        speed: 1,
      });
      expect(eventsOfType("mos:in", shown)).toHaveLength(1);
    });
  });

  // ===================================================================
  // (e) REMOVING ELEMENTS
  // ===================================================================

  describe("removing tracked elements", () => {
    it("should cancel the controls of a removed element on refreshHard() and leave the rest alone", () => {
      const shown = addMosElement(100);
      const removedShown = addMosElement(300);
      const removedBelow = addMosElement(2000);
      const below = addMosElement(2000);
      MOS.init({ disableMutationObserver: true });

      const shownBefore = snapshot(onlyControls(shown));
      const belowBefore = snapshot(onlyControls(below));

      removedShown.remove();
      removedBelow.remove();
      MOS.refreshHard();

      expect(onlyControls(removedShown).cancel).toHaveBeenCalledTimes(1);
      expect(onlyControls(removedBelow).cancel).toHaveBeenCalledTimes(1);
      expect(snapshot(onlyControls(shown))).toEqual(shownBefore);
      expect(snapshot(onlyControls(below))).toEqual(belowBefore);
      expect(isShown(shown)).toBe(true);

      // The removed element is no longer driven by scroll, the remaining one is
      scrollTo(1500);
      expect(onlyControls(removedBelow).play).not.toHaveBeenCalled();
      expect(isShown(removedBelow)).toBe(false);
      expect(isShown(below)).toBe(true);
      expect(eventsOfType("mos:in", removedBelow)).toHaveLength(0);

      // Cancelled only once, however often the page refreshes afterwards
      MOS.refreshHard();
      MOS.refresh();
      expect(onlyControls(removedShown).cancel).toHaveBeenCalledTimes(1);
      expect(onlyControls(removedBelow).cancel).toHaveBeenCalledTimes(1);
    });

    it("should cancel the controls of a removed element through the MutationObserver", async () => {
      const shown = addMosElement(100);
      const wrapper = document.createElement("section");
      const nested = createMosElement(2000);
      wrapper.appendChild(nested);
      document.body.appendChild(wrapper);
      MOS.init();

      const shownBefore = snapshot(onlyControls(shown));

      wrapper.remove();
      await flushMutations();

      expect(onlyControls(nested).cancel).toHaveBeenCalledTimes(1);
      expect(snapshot(onlyControls(shown))).toEqual(shownBefore);

      scrollTo(1500);
      expect(onlyControls(nested).play).not.toHaveBeenCalled();
    });

    it("should treat a removed element that is added back as a new element", () => {
      const element = addMosElement(100);
      MOS.init({ disableMutationObserver: true });
      expect(eventsOfType("mos:in", element)).toHaveLength(1);

      element.remove();
      MOS.refreshHard();
      document.body.appendChild(element);
      MOS.refreshHard();

      const [first, second] = allControls(element);
      expect(allControls(element)).toHaveLength(2);
      expect(first.cancel).toHaveBeenCalledTimes(1);
      expect(second.play).toHaveBeenCalledTimes(1);
      expect(second.cancel).not.toHaveBeenCalled();
      expect(isShown(element)).toBe(true);
    });

    it("should not throw when cancelling a removed element's animation fails", () => {
      const removed = addMosElement(100);
      const kept = addMosElement(2000);
      MOS.init({ disableMutationObserver: true });
      onlyControls(removed).cancel.mockImplementation(() => {
        throw new Error("element is detached");
      });

      removed.remove();
      expect(() => MOS.refreshHard()).not.toThrow();

      scrollTo(1500);
      expect(isShown(kept)).toBe(true);
    });
  });

  // ===================================================================
  // (f) INIT AGAIN WITH DIFFERENT OPTIONS
  // ===================================================================

  describe("calling init() again", () => {
    it("should rebuild animations for a new duration while shown elements stay shown", () => {
      const shown = addMosElement(100);
      const reversed = addMosElement(1500);
      const below = addMosElement(4000);
      MOS.init();
      scrollTo(1000);
      scrollTo(0);
      expect(isShown(shown)).toBe(true);
      expect(isShown(reversed)).toBe(false);
      const eventsBefore = events.length;

      MOS.init({ duration: 800 });

      // Every element got exactly one replacement animation with the new duration
      [shown, reversed, below].forEach((element) => {
        expect(animateCount(element)).toBe(2);
        const [oldControls, newControls] = allControls(element);
        expect(oldControls.cancel).toHaveBeenCalledTimes(1);
        expect(newControls.cancel).not.toHaveBeenCalled();
        const lastCall = animateMock.mock.calls.filter(([target]) => target === element)[1];
        expect(lastCall[2]).toEqual({ duration: 0.8, ease: EASE, autoplay: false });
      });

      // Shown element: jumps to the end of the new animation, is not played or announced again
      const [, shownControls] = allControls(shown);
      expect(shown.className).toBe("mos-init mos-animate");
      expect(shownControls.complete).toHaveBeenCalledTimes(1);
      expect(shownControls.play).not.toHaveBeenCalled();
      expect(shownControls.pause).not.toHaveBeenCalled();

      // Hidden elements: waiting at the start of the new animation
      [reversed, below].forEach((element) => {
        const [, newControls] = allControls(element);
        expect(isShown(element)).toBe(false);
        expect(newControls.pause).toHaveBeenCalledTimes(1);
        expect(newControls.play).not.toHaveBeenCalled();
        expect(newControls.complete).not.toHaveBeenCalled();
      });

      expect(events.slice(eventsBefore)).toEqual([]);

      // The rebuilt animations are the ones driven from now on
      scrollTo(1000);
      const [oldReversed, newReversed] = allControls(reversed);
      expect(isShown(reversed)).toBe(true);
      expect(newReversed.play).toHaveBeenCalledTimes(1);
      expect(oldReversed.play).toHaveBeenCalledTimes(2); // unchanged: one play, one reverse

      // ...and the shown element can still be hidden through its new animation
      MOS.init({ mirror: true });
      scrollTo(positionOut(100));
      expect(isShown(shown)).toBe(false);
      expect(shownControls.play).toHaveBeenCalledTimes(1);
      expect(shownControls.speed).toBe(-1);
      expect(animateCount(shown)).toBe(2);
    });

    it("should not rebuild the animation of elements that override the changed option", () => {
      const overriding = addMosElement(100, { "data-mos-duration": "250" });
      const inheriting = addMosElement(200);
      MOS.init();

      MOS.init({ duration: 800 });

      expect(animateCount(overriding)).toBe(1);
      expect(snapshot(onlyControls(overriding))).toEqual({
        play: 1,
        pause: 1,
        stop: 0,
        complete: 0,
        cancel: 0,
        speed: 1,
      });
      expect(animateCount(inheriting)).toBe(2);
      expect(isShown(overriding)).toBe(true);
      expect(isShown(inheriting)).toBe(true);
    });

    it("should keep the existing animations when init() is called again with the same options", () => {
      const shown = addMosElement(100);
      const below = addMosElement(2000);
      MOS.init({ duration: 800 });
      const before = [snapshot(onlyControls(shown)), snapshot(onlyControls(below))];
      const eventsBefore = events.length;

      MOS.init({ duration: 800 });
      MOS.init();
      MOS.init({});

      expect(animateMock).toHaveBeenCalledTimes(2);
      expect([snapshot(onlyControls(shown)), snapshot(onlyControls(below))]).toEqual(before);
      expect(events.slice(eventsBefore)).toEqual([]);
      expect(isShown(shown)).toBe(true);
      expect(isShown(below)).toBe(false);
    });

    it("should accumulate options across init() calls", () => {
      const shown = addMosElement(100);
      MOS.init({ duration: 800 });

      // A later call without duration must not fall back to the default duration
      MOS.init({ once: true });
      expect(animateCount(shown)).toBe(1);

      MOS.init({ delay: 200 });
      expect(animateCount(shown)).toBe(2);
      expect(animateMock.mock.calls[1][2]).toEqual({ duration: 0.8, ease: EASE, autoplay: false });
    });

    it("should apply non-animation options without rebuilding animations", () => {
      const shown = addMosElement(100);
      const below = addMosElement(2000);
      MOS.init();
      scrollTo(1500);
      expect(isShown(below)).toBe(true);
      const eventsBefore = events.length;

      // once: the shown element must now stay shown when scrolling back up
      MOS.init({ once: true });
      scrollTo(0);

      expect(isShown(below)).toBe(true);
      expect(onlyControls(below).play).toHaveBeenCalledTimes(1);
      expect(onlyControls(shown).play).toHaveBeenCalledTimes(1);
      expect(events.slice(eventsBefore)).toEqual([]);
    });

    it("should re-evaluate positions when the offset changes on a later init()", () => {
      const element = addMosElement(1100); // in at 220 with the default offset, at 100 without
      MOS.init();
      scrollTo(150);
      expect(isShown(element)).toBe(false);

      MOS.init({ offset: 0 });

      expect(isShown(element)).toBe(true);
      expect(onlyControls(element).play).toHaveBeenCalledTimes(1);
    });
  });

  // ===================================================================
  // (g) EVENTS
  // ===================================================================

  describe("mos:in / mos:out events", () => {
    it("should dispatch mos:in on the document with the element as detail when it is shown", () => {
      const inView = addMosElement(100);
      const below = addMosElement(2000);

      MOS.init();

      expect(events).toEqual([{ type: "mos:in", detail: inView }]);

      scrollTo(1500);

      expect(events).toEqual([
        { type: "mos:in", detail: inView },
        { type: "mos:in", detail: below },
      ]);
    });

    it("should dispatch mos:out with the element as detail when it is hidden", () => {
      addMosElement(100);
      const below = addMosElement(2000);
      MOS.init();
      scrollTo(1500);
      events.length = 0;

      scrollTo(0);

      expect(events).toEqual([{ type: "mos:out", detail: below }]);
    });

    it("should dispatch CustomEvents exactly once per transition", () => {
      const below = addMosElement(2000);
      const received: Event[] = [];
      const listener = (event: Event): void => {
        received.push(event);
      };
      document.addEventListener("mos:in", listener);
      MOS.init();

      scrollTo(1500);
      scrollTo(1600);
      scrollTo(1700);
      document.removeEventListener("mos:in", listener);

      expect(received).toHaveLength(1);
      expect(received[0]).toBeInstanceOf(CustomEvent);
      expect((received[0] as CustomEvent).detail).toBe(below);
      expect(eventsOfType("mos:out")).toHaveLength(0);
    });

    it("should also dispatch mos:in:<id> / mos:out:<id> for elements with data-mos-id", () => {
      const hero = addMosElement(2000, { "data-mos-id": "hero" });
      const other = addMosElement(4000, { "data-mos-id": "other" });
      const anonymous = addMosElement(2000);
      MOS.init();

      scrollTo(1500);

      expect(events).toEqual([
        { type: "mos:in", detail: hero },
        { type: "mos:in:hero", detail: hero },
        { type: "mos:in", detail: anonymous },
      ]);

      events.length = 0;
      scrollTo(0);

      expect(events).toEqual([
        { type: "mos:out", detail: hero },
        { type: "mos:out:hero", detail: hero },
        { type: "mos:out", detail: anonymous },
      ]);

      events.length = 0;
      scrollTo(3500);

      expect(eventsOfType("mos:in:other")).toEqual([{ type: "mos:in:other", detail: other }]);
      expect(eventsOfType("mos:in:hero")).toEqual([{ type: "mos:in:hero", detail: hero }]);
      expect(eventsOfType("mos:out:other")).toEqual([]);
    });

    it("should update the element class before dispatching the event", () => {
      const below = addMosElement(2000);
      const classAtEvent: Record<string, boolean> = {};
      const onIn = (): void => {
        classAtEvent.in = isShown(below);
      };
      const onOut = (): void => {
        classAtEvent.out = isShown(below);
      };
      document.addEventListener("mos:in", onIn);
      document.addEventListener("mos:out", onOut);
      MOS.init();

      scrollTo(1500);
      scrollTo(0);
      document.removeEventListener("mos:in", onIn);
      document.removeEventListener("mos:out", onOut);

      expect(classAtEvent).toEqual({ in: true, out: false });
    });
  });

  // ===================================================================
  // (h) DESTROY
  // ===================================================================

  describe("destroy()", () => {
    it("should stop reacting to scroll, resize and DOM changes", async () => {
      const shown = addMosElement(100);
      const below = addMosElement(2000);
      MOS.init();
      const shownBefore = snapshot(onlyControls(shown));
      const belowBefore = snapshot(onlyControls(below));

      MOS.destroy();
      events.length = 0;

      scrollTo(1500);
      place(below, 200);
      resize();
      window.dispatchEvent(new Event("orientationchange"));
      vi.advanceTimersByTime(200);
      const added = addMosElement(300);
      await flushMutations();
      MOS.refresh();

      expect(events).toEqual([]);
      expect(animateMock).toHaveBeenCalledTimes(2);
      expect(snapshot(onlyControls(shown))).toEqual(shownBefore);
      expect(snapshot(onlyControls(below))).toEqual(belowBefore);
      expect(isShown(below)).toBe(false);
      expect(added.className).toBe("");

      // Elements keep the visual state they were in
      expect(shown.className).toBe("mos-init mos-animate");
    });

    it("should be safe to call before init() and more than once", () => {
      expect(() => {
        MOS.destroy();
        MOS.destroy();
      }).not.toThrow();

      addMosElement(100);
      MOS.init();
      expect(() => {
        MOS.destroy();
        MOS.destroy();
      }).not.toThrow();
    });

    it("should work again after a later init()", async () => {
      const shown = addMosElement(100);
      const below = addMosElement(2000);
      MOS.init();
      MOS.destroy();
      events.length = 0;
      const animateCallsBefore = animateMock.mock.calls.length;

      const returned = MOS.init();

      expect(returned).toEqual([shown, below]);
      expect(animateMock.mock.calls.length).toBe(animateCallsBefore + 2);
      expect(isShown(shown)).toBe(true);
      expect(isShown(below)).toBe(false);

      // Exactly one scroll listener is active: one play per transition
      scrollTo(1500);
      const belowControls = allControls(below).at(-1)!;
      expect(isShown(below)).toBe(true);
      expect(belowControls.play).toHaveBeenCalledTimes(1);
      expect(eventsOfType("mos:in", below)).toHaveLength(1);

      scrollTo(0);
      expect(isShown(below)).toBe(false);
      expect(belowControls.play).toHaveBeenCalledTimes(2);
      expect(belowControls.speed).toBe(-1);
      expect(eventsOfType("mos:out", below)).toHaveLength(1);

      // The MutationObserver is back as well
      const added = addMosElement(300);
      await flushMutations();
      expect(added.className).toBe("mos-init mos-animate");

      // The animations from before destroy() are not driven any more
      const [oldBelowControls] = allControls(below);
      expect(oldBelowControls).not.toBe(belowControls);
      expect(oldBelowControls.play).not.toHaveBeenCalled();
    });

    it("should forget the options passed to earlier init() calls", () => {
      const below = addMosElement(2000);
      MOS.init({ once: true, duration: 800, offset: 0 });
      MOS.destroy();

      MOS.init();

      // Defaults again: default duration, default offset, and no `once`
      expect(animateMock.mock.calls.at(-1)![2]).toEqual({
        duration: 0.4,
        ease: EASE,
        autoplay: false,
      });

      scrollTo(positionIn(2000) - 1);
      expect(isShown(below)).toBe(false);
      scrollTo(positionIn(2000));
      expect(isShown(below)).toBe(true);
      scrollTo(0);
      expect(isShown(below)).toBe(false);
    });

    it("should not leave duplicate listeners behind after several init()/destroy() cycles", () => {
      const below = addMosElement(2000);
      for (let i = 0; i < 3; i++) {
        MOS.init();
        MOS.destroy();
      }
      MOS.init();
      events.length = 0;

      scrollTo(1500);

      expect(events).toEqual([{ type: "mos:in", detail: below }]);
      expect(allControls(below).at(-1)!.play).toHaveBeenCalledTimes(1);
      // The animations of the destroyed runs stay untouched
      allControls(below)
        .slice(0, -1)
        .forEach((controls) => expect(controls.play).not.toHaveBeenCalled());
    });
  });

  // ===================================================================
  // (i) RESIZE
  // ===================================================================

  describe("resize", () => {
    it("should recalculate positions after the debounce delay", () => {
      const moving = addMosElement(3000);
      MOS.init();
      const controls = onlyControls(moving);

      // The layout changes: the element is now within the viewport
      place(moving, 500);
      window.dispatchEvent(new Event("resize"));

      // Debounced: nothing yet
      vi.advanceTimersByTime(49);
      expect(isShown(moving)).toBe(false);

      vi.advanceTimersByTime(1);
      expect(isShown(moving)).toBe(true);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(animateCount(moving)).toBe(1);
    });

    it("should use the recalculated positions for later scroll events", () => {
      const moving = addMosElement(3000);
      MOS.init();

      place(moving, 6000);
      resize();
      expect(isShown(moving)).toBe(false);

      // In view by the old layout, still below by the new one
      scrollTo(positionIn(3000) + 100);
      expect(isShown(moving)).toBe(false);

      scrollTo(positionIn(6000));
      expect(isShown(moving)).toBe(true);
      expect(onlyControls(moving).play).toHaveBeenCalledTimes(1);
    });

    it("should not reset, pause or re-announce animated elements", () => {
      const shown = addMosElement(100);
      const scrolledIn = addMosElement(1500);
      const once = addMosElement(1500, { "data-mos-once": "true" });
      MOS.init();
      scrollTo(1000);
      const tracked = [shown, scrolledIn, once];
      const before = tracked.map((element) => snapshot(onlyControls(element)));
      const eventsBefore = events.length;

      // Layout shifts a little, everything is still in view
      place(scrolledIn, 1600);
      resize();
      window.dispatchEvent(new Event("orientationchange"));
      vi.advanceTimersByTime(200);
      resize();

      expect(tracked.map((element) => snapshot(onlyControls(element)))).toEqual(before);
      tracked.forEach((element) => {
        expect(element.className).toBe("mos-init mos-animate");
        expect(animateCount(element)).toBe(1);
      });
      expect(events.slice(eventsBefore)).toEqual([]);
    });

    it("should not pause an element that is hidden after being reversed", () => {
      const reversed = addMosElement(1500);
      MOS.init();
      const controls = onlyControls(reversed);
      scrollTo(1000);
      scrollTo(0);
      expect(isShown(reversed)).toBe(false);
      expect(snapshot(controls)).toEqual({
        play: 2,
        pause: 1, // the initial pause from init()
        stop: 0,
        complete: 0,
        cancel: 0,
        speed: -1,
      });
      const eventsBefore = events.length;

      resize();
      resize();

      // Still running its reversed animation: not paused, completed, cancelled or re-created
      expect(snapshot(controls)).toEqual({
        play: 2,
        pause: 1,
        stop: 0,
        complete: 0,
        cancel: 0,
        speed: -1,
      });
      expect(animateCount(reversed)).toBe(1);
      expect(isShown(reversed)).toBe(false);
      expect(events.slice(eventsBefore)).toEqual([]);
    });

    it("should hide a shown element that the new layout pushed back below the viewport", () => {
      const shown = addMosElement(600);
      const onceShown = addMosElement(600, { "data-mos-once": "true" });
      MOS.init();
      expect(isShown(shown)).toBe(true);

      place(shown, 5000);
      place(onceShown, 5000);
      resize();

      expect(isShown(shown)).toBe(false);
      expect(onlyControls(shown).play).toHaveBeenCalledTimes(2);
      expect(onlyControls(shown).speed).toBe(-1);
      expect(eventsOfType("mos:out", shown)).toHaveLength(1);

      // once elements stay shown regardless
      expect(isShown(onceShown)).toBe(true);
      expect(onlyControls(onceShown).play).toHaveBeenCalledTimes(1);
    });

    it("should do nothing before the library has started", () => {
      MOS.destroy();
      const element = addMosElement(100);
      Object.defineProperty(document, "readyState", { value: "loading", configurable: true });

      try {
        MOS.init();
        resize();
        scrollTo(50);

        expect(animateCount(element)).toBe(0);
        expect(element.className).toBe("");
        expect(events).toEqual([]);

        // The start event kicks everything off
        document.dispatchEvent(new Event("DOMContentLoaded"));
        expect(element.className).toBe("mos-init mos-animate");
        expect(onlyControls(element).play).toHaveBeenCalledTimes(1);
      } finally {
        delete (document as unknown as Record<string, unknown>).readyState;
      }
    });
  });
  // ===================================================================
  // (j) SHOW DELAY
  // ===================================================================
  // The delay is applied by MOS with a timer (not by Motion), only on the way in.
  // Note that scrollTo() itself advances the clock by 200ms.

  describe("show delay", () => {
    const DELAY = 1000;
    const TOP = 2000;

    function addDelayed(attributes: Record<string, string> = {}): HTMLElement {
      return addMosElement(TOP, { "data-mos-delay": String(DELAY), ...attributes });
    }

    it("should mark the element as shown at once but start the animation only after the delay", () => {
      const element = addDelayed({ "data-mos-id": "hero" });
      MOS.init();
      const controls = onlyControls(element);

      scrollTo(positionIn(TOP)); // 200ms of the delay pass here

      expect(isShown(element)).toBe(true);
      expect(events).toEqual([
        { type: "mos:in", detail: element },
        { type: "mos:in:hero", detail: element },
      ]);
      expect(controls.play).not.toHaveBeenCalled();

      vi.advanceTimersByTime(DELAY - 200 - 1);
      expect(controls.play).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.speed).toBe(1);

      // Nothing more happens afterwards
      vi.advanceTimersByTime(10 * DELAY);
      scrollTo(positionIn(TOP) + 50);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(events).toHaveLength(2);
      expect(animateCount(element)).toBe(1);
    });

    it("should delay an element that is in view on load", () => {
      const element = addMosElement(100, { "data-mos-delay": "300" });
      MOS.init();
      const controls = onlyControls(element);

      expect(isShown(element)).toBe(true);
      expect(eventsOfType("mos:in", element)).toHaveLength(1);
      expect(controls.play).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(controls.play).toHaveBeenCalledTimes(1);
    });

    it("should use a global delay, and seconds when timeUnits is s", () => {
      const element = addMosElement(100);
      MOS.init({ timeUnits: "s", delay: 0.5 });
      const controls = onlyControls(element);

      expect(animateMock.mock.calls[0][2]).toEqual({ duration: 0.4, ease: EASE, autoplay: false });
      vi.advanceTimersByTime(499);
      expect(controls.play).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(controls.play).toHaveBeenCalledTimes(1);
    });

    it("should never start the animation when the element is hidden before the delay elapses", () => {
      const element = addDelayed();
      MOS.init();
      const controls = onlyControls(element);

      scrollTo(positionIn(TOP));
      expect(isShown(element)).toBe(true);

      scrollTo(0);

      expect(isShown(element)).toBe(false);
      expect(element.className).toBe("mos-init");
      // The controls were never touched: not played forwards, not reversed
      expect(controls.play).not.toHaveBeenCalled();
      expect(controls.speed).toBe(1);

      vi.advanceTimersByTime(10 * DELAY);

      expect(controls.play).not.toHaveBeenCalled();
      expect(controls.speed).toBe(1);
      expect(isShown(element)).toBe(false);
      expect(events).toEqual([
        { type: "mos:in", detail: element },
        { type: "mos:out", detail: element },
      ]);
    });

    it("should start the delay afresh when the element is shown again", () => {
      const element = addDelayed();
      MOS.init();
      const controls = onlyControls(element);

      scrollTo(positionIn(TOP));
      vi.advanceTimersByTime(600); // 800ms into the first delay
      scrollTo(0);
      scrollTo(positionIn(TOP)); // second show; 200ms of its delay pass here

      // the first timer would have fired by now
      vi.advanceTimersByTime(DELAY - 200 - 1);
      expect(controls.play).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.speed).toBe(1);
      expect(eventsOfType("mos:in", element)).toHaveLength(2);
      expect(eventsOfType("mos:out", element)).toHaveLength(1);
    });

    it("should hide without any delay", () => {
      const element = addDelayed();
      MOS.init();
      const controls = onlyControls(element);
      scrollTo(positionIn(TOP));
      vi.advanceTimersByTime(DELAY);
      expect(controls.play).toHaveBeenCalledTimes(1);

      // dispatch the scroll without letting any further time pass than the throttle needs
      scrollTo(0);

      expect(controls.speed).toBe(-1);
      expect(controls.play).toHaveBeenCalledTimes(2);
      expect(isShown(element)).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("should let a pending show fire exactly once on the same controls after refreshHard()", () => {
      const element = addDelayed();
      const other = addMosElement(100);
      MOS.init();
      const controls = onlyControls(element);
      scrollTo(positionIn(TOP));
      const eventsBefore = events.length;

      MOS.refreshHard();
      MOS.refreshHard();

      // Same animation, still shown, still waiting, not announced again
      expect(onlyControls(element)).toBe(controls);
      expect(isShown(element)).toBe(true);
      expect(controls.play).not.toHaveBeenCalled();
      expect(controls.pause).toHaveBeenCalledTimes(1);
      expect(controls.complete).not.toHaveBeenCalled();
      expect(controls.cancel).not.toHaveBeenCalled();
      expect(events).toHaveLength(eventsBefore);

      // The refresh did not restart the delay either
      vi.advanceTimersByTime(DELAY - 200 - 1);
      expect(controls.play).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.speed).toBe(1);

      vi.advanceTimersByTime(10 * DELAY);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(onlyControls(other).play).toHaveBeenCalledTimes(1);
    });

    it("should still cancel a pending show when the element is hidden after refreshHard()", () => {
      const element = addDelayed();
      MOS.init();
      const controls = onlyControls(element);
      scrollTo(positionIn(TOP));

      MOS.refreshHard();
      scrollTo(0);

      expect(isShown(element)).toBe(false);
      vi.advanceTimersByTime(10 * DELAY);

      expect(controls.play).not.toHaveBeenCalled();
      expect(controls.speed).toBe(1);
      expect(eventsOfType("mos:in", element)).toHaveLength(1);
      expect(eventsOfType("mos:out", element)).toHaveLength(1);
    });

    it("should keep a pending show through a resize and a MutationObserver refresh", async () => {
      const element = addDelayed();
      MOS.init();
      const controls = onlyControls(element);
      scrollTo(positionIn(TOP)); // 200ms

      resize(); // 400ms
      addMosElement(6000);
      await flushMutations();

      expect(controls.play).not.toHaveBeenCalled();
      expect(isShown(element)).toBe(true);

      vi.advanceTimersByTime(DELAY);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.complete).not.toHaveBeenCalled();
      expect(eventsOfType("mos:in", element)).toHaveLength(1);
    });

    it("should not start a pending show after destroy()", () => {
      const element = addDelayed();
      MOS.init();
      const controls = onlyControls(element);
      scrollTo(positionIn(TOP));

      MOS.destroy();
      vi.advanceTimersByTime(10 * DELAY);

      expect(controls.play).not.toHaveBeenCalled();
      expect(controls.complete).not.toHaveBeenCalled();
      expect(controls.cancel).not.toHaveBeenCalled();
      // destroy() leaves the element as it is
      expect(element.className).toBe("mos-init mos-animate");
      expect(events).toEqual([{ type: "mos:in", detail: element }]);
    });

    it("should not start a pending show after the element was removed", () => {
      const element = addDelayed();
      MOS.init();
      const controls = onlyControls(element);
      scrollTo(positionIn(TOP));

      element.remove();
      MOS.refreshHard();
      vi.advanceTimersByTime(10 * DELAY);

      expect(controls.cancel).toHaveBeenCalledTimes(1);
      expect(controls.play).not.toHaveBeenCalled();
    });

    it("should not start the old animation when a pending show's animation is rebuilt", () => {
      const element = addDelayed();
      MOS.init();
      scrollTo(positionIn(TOP));

      MOS.init({ duration: 800 });
      vi.advanceTimersByTime(10 * DELAY);

      const [oldControls, newControls] = allControls(element);
      expect(animateCount(element)).toBe(2);
      expect(oldControls.cancel).toHaveBeenCalledTimes(1);
      expect(oldControls.play).not.toHaveBeenCalled();
      // the element counts as shown, so the new animation is put at its end
      expect(isShown(element)).toBe(true);
      expect(newControls.complete).toHaveBeenCalledTimes(1);
      expect(newControls.play).not.toHaveBeenCalled();
      expect(eventsOfType("mos:in", element)).toHaveLength(1);
      expect(eventsOfType("mos:out", element)).toHaveLength(0);
    });

    it("should not start a pending show after MOS is disabled", () => {
      const element = addDelayed();
      MOS.init();
      const controls = onlyControls(element);
      const speeds = recordSpeedAtComplete(controls);
      scrollTo(positionIn(TOP));

      expect(MOS.init({ disable: true })).toEqual([]);
      vi.advanceTimersByTime(10 * DELAY);

      expect(controls.play).not.toHaveBeenCalled();
      expect(speeds).toEqual([1]);
      expect(element.className).toBe("");
      expect(element.hasAttribute("data-mos")).toBe(false);
      expect(element.hasAttribute("data-mos-delay")).toBe(false);
    });

    it("should delay a custom animation itself and hand its factory a delay of 0", () => {
      const custom: FakeControls = {
        play: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
        complete: vi.fn(),
        cancel: vi.fn(),
        speed: 0,
        time: 0,
        finished: Promise.resolve(),
      };
      const factory = vi.fn((_element: HTMLElement, _options: unknown) => custom as never);
      MOS.registerAnimation("lifecycle-custom", factory);
      const element = addMosElement(TOP, { "data-mos-delay": String(DELAY) }, "lifecycle-custom");
      MOS.init();

      expect(factory).toHaveBeenCalledTimes(1);
      expect(factory.mock.calls[0][0]).toBe(element);
      expect(factory.mock.calls[0][1]).toMatchObject({ delay: 0, timeUnits: "ms" });
      expect(animateMock).not.toHaveBeenCalled();

      setScrollY(positionIn(TOP));
      window.dispatchEvent(new Event("scroll"));

      // shown right away as far as state goes, but not playing until the delay has passed
      expect(isShown(element)).toBe(true);
      expect(custom.play).not.toHaveBeenCalled();

      vi.advanceTimersByTime(DELAY);
      expect(custom.speed).toBe(1);
      expect(custom.play).toHaveBeenCalledTimes(1);

      // hiding reverses straight away: there is no delay on the way out
      scrollTo(0);
      expect(custom.speed).toBe(-1);
      expect(custom.play).toHaveBeenCalledTimes(2);
    });
  });

  // ===================================================================
  // (k) DISABLING AFTER ELEMENTS HAVE ANIMATED
  // ===================================================================

  describe("disabling after activation", () => {
    it("should complete a shown-then-hidden element forwards and strip everything", () => {
      const hidden = addMosElement(2000, { "data-mos-id": "hero", class: "card" });
      const shown = addMosElement(100);
      const below = addMosElement(6000);
      MOS.init();
      scrollTo(positionIn(2000));
      scrollTo(0);

      const hiddenControls = onlyControls(hidden);
      const shownControls = onlyControls(shown);
      const belowControls = onlyControls(below);
      expect(hiddenControls.speed).toBe(-1);
      expect(isShown(hidden)).toBe(false);
      const speeds = [hiddenControls, shownControls, belowControls].map(recordSpeedAtComplete);
      const playsBefore = hiddenControls.play.mock.calls.length;
      events.length = 0;

      const returned = MOS.init({ disable: true });

      expect(returned).toEqual([]);
      // Every animation was completed exactly once, running forwards at that moment
      expect(speeds).toEqual([[1], [1], [1]]);
      expect(hiddenControls.speed).toBe(1);
      expect(hiddenControls.play).toHaveBeenCalledTimes(playsBefore);
      expect(hiddenControls.cancel).not.toHaveBeenCalled();

      // Plain content again
      expect(hidden.className).toBe("card");
      expect(shown.className).toBe("");
      expect(below.className).toBe("");
      [hidden, shown, below].forEach((element) => {
        const names = Array.from(element.attributes).map((attribute) => attribute.name);
        expect(names.filter((name) => name.startsWith("data-mos"))).toEqual([]);
      });
    });

    it("should stop reacting to scroll, resize and DOM changes afterwards", async () => {
      const element = addMosElement(2000);
      MOS.init();
      const controls = onlyControls(element);
      MOS.init({ disable: true });
      const before = snapshot(controls);
      events.length = 0;

      scrollTo(positionIn(2000) + 100);
      resize();
      const added = addMosElement(100);
      await flushMutations();
      MOS.refresh();

      expect(snapshot(controls)).toEqual(before);
      expect(events).toEqual([]);
      expect(animateCount(added)).toBe(0);
      expect(added.className).toBe("");
      expect(animateMock).toHaveBeenCalledTimes(1);
    });

    it("should complete reversed elements forwards when refreshHard() finds MOS disabled", () => {
      let disabled = false;
      const element = addMosElement(2000);
      MOS.init({ disable: () => disabled });
      scrollTo(positionIn(2000));
      scrollTo(0);
      const controls = onlyControls(element);
      const speeds = recordSpeedAtComplete(controls);
      expect(controls.speed).toBe(-1);

      disabled = true;
      MOS.refreshHard();

      expect(speeds).toEqual([1]);
      expect(element.className).toBe("");
      expect(element.hasAttribute("data-mos")).toBe(false);

      scrollTo(positionIn(2000) + 100);
      expect(controls.play).toHaveBeenCalledTimes(2);
    });

    it("should complete reversed elements forwards through the MutationObserver when reduced motion starts to apply", async () => {
      const element = addMosElement(2000);
      MOS.init();
      scrollTo(positionIn(2000));
      scrollTo(0);
      const controls = onlyControls(element);
      const speeds = recordSpeedAtComplete(controls);

      const original = (window as unknown as Record<string, unknown>).matchMedia;
      (window as unknown as Record<string, unknown>).matchMedia = (query: string) => ({
        matches: true,
        media: query,
      });
      try {
        const added = addMosElement(100);
        await flushMutations();

        expect(speeds).toEqual([1]);
        expect(element.className).toBe("");
        expect(element.hasAttribute("data-mos")).toBe(false);
        expect(added.hasAttribute("data-mos")).toBe(false);
        expect(animateCount(added)).toBe(0);
      } finally {
        if (original === undefined) {
          delete (window as unknown as Record<string, unknown>).matchMedia;
        } else {
          (window as unknown as Record<string, unknown>).matchMedia = original;
        }
      }
    });
  });

  // ===================================================================
  // (l) FINAL STATE AFTER A REVERSE
  // ===================================================================

  describe("rebuilding or finalising a reversed animation", () => {
    it("should complete forwards when a layout change puts a reversed element above the viewport", () => {
      const element = addMosElement(2000);
      MOS.init();
      scrollTo(positionIn(2000));
      scrollTo(0);
      const controls = onlyControls(element);
      const speeds = recordSpeedAtComplete(controls);
      expect(controls.speed).toBe(-1);
      events.length = 0;

      // Jump far down the page (e.g. an anchor link) and have the layout re-evaluated
      setScrollY(8000);
      resize();

      expect(speeds).toEqual([1]);
      expect(isShown(element)).toBe(true);
      expect(events).toEqual([{ type: "mos:in", detail: element }]);
      expect(controls.play).toHaveBeenCalledTimes(2);
    });
  });

  // ===================================================================
  // (m) ABOVE THE VIEWPORT BUT NOT YET TRIGGERED
  // ===================================================================
  // Regression: such an element used to be put in its final state by every
  // refresh and then hidden again by the scroll pass (mos:in + mos:out each time).

  describe("elements above the viewport that are not due yet", () => {
    it("should leave an element anchored to something far below hidden and silent", async () => {
      const target = document.createElement("div");
      target.id = "far-below";
      place(target, 5000);
      document.body.appendChild(target);
      const element = addMosElement(100, { "data-mos-anchor": "#far-below" });
      const trigger = positionIn(5000);
      setScrollY(1500); // the element itself (100-200) is above the viewport

      MOS.init();

      const controls = onlyControls(element);
      expect(isShown(element)).toBe(false);
      expect(element.className).toBe("mos-init");
      expect(controls.pause).toHaveBeenCalledTimes(1);
      expect(controls.complete).not.toHaveBeenCalled();
      expect(controls.play).not.toHaveBeenCalled();
      expect(events).toEqual([]);

      // Refreshes of every kind keep it that way
      resize();
      resize();
      MOS.refresh();
      MOS.refreshHard();
      addMosElement(9000);
      await flushMutations();
      scrollTo(1600);

      expect(events).toEqual([]);
      expect(isShown(element)).toBe(false);
      expect(snapshot(controls)).toEqual({
        play: 0,
        pause: 1,
        stop: 0,
        complete: 0,
        cancel: 0,
        speed: 1,
      });

      // It animates in normally once its anchor is reached
      scrollTo(trigger - 1);
      expect(isShown(element)).toBe(false);
      scrollTo(trigger);
      expect(isShown(element)).toBe(true);
      expect(controls.play).toHaveBeenCalledTimes(1);
      expect(controls.complete).not.toHaveBeenCalled();
      expect(events).toEqual([{ type: "mos:in", detail: element }]);
    });

    it("should leave an element with a top placement and a large offset hidden and silent", () => {
      // trigger = top (3000) + inline offset (500); the element's bottom edge is at 3100
      const element = addMosElement(3000, {
        "data-mos-anchor-placement": "top-top",
        "data-mos-offset": "500",
      });
      setScrollY(3200);

      MOS.init();
      resize();
      MOS.refreshHard();

      const controls = onlyControls(element);
      expect(events).toEqual([]);
      expect(isShown(element)).toBe(false);
      expect(controls.complete).not.toHaveBeenCalled();
      expect(controls.play).not.toHaveBeenCalled();

      scrollTo(3499);
      expect(isShown(element)).toBe(false);
      scrollTo(3500);
      expect(isShown(element)).toBe(true);
      expect(events).toEqual([{ type: "mos:in", detail: element }]);
    });

    it("should announce an element above the viewport that is past its trigger only once", () => {
      const element = addMosElement(100);
      setScrollY(5000);

      MOS.init();
      resize();
      MOS.refresh();
      MOS.refreshHard();

      const controls = onlyControls(element);
      expect(events).toEqual([{ type: "mos:in", detail: element }]);
      expect(controls.complete).toHaveBeenCalledTimes(1);
      expect(controls.play).not.toHaveBeenCalled();
    });
  });

  // ===================================================================
  // (n) INLINE ANCHOR PLACEMENT AND THE GLOBAL OFFSET (AOS QUIRK)
  // ===================================================================

  describe("offset with an inline anchor placement", () => {
    it("should ignore the global offset for an element with an inline placement", () => {
      // top-center: trigger = top - windowHeight + windowHeight / 2 (+ no offset)
      const element = addMosElement(3000, { "data-mos-anchor-placement": "top-center" });
      MOS.init({ offset: 300 });

      scrollTo(2499);
      expect(isShown(element)).toBe(false);
      scrollTo(2500);
      expect(isShown(element)).toBe(true);
    });

    it("should apply the global offset when the placement is only set globally", () => {
      const element = addMosElement(3000);
      MOS.init({ offset: 300, anchorPlacement: "top-center" });

      scrollTo(2799);
      expect(isShown(element)).toBe(false);
      scrollTo(2800);
      expect(isShown(element)).toBe(true);
    });

    it("should apply an inline offset next to an inline placement", () => {
      const element = addMosElement(3000, {
        "data-mos-anchor-placement": "top-center",
        "data-mos-offset": "50",
      });
      MOS.init({ offset: 300 });

      scrollTo(2549);
      expect(isShown(element)).toBe(false);
      scrollTo(2550);
      expect(isShown(element)).toBe(true);
    });

    it("should still apply the global offset on the way out of a mirror element", () => {
      const element = addMosElement(3000, {
        "data-mos-anchor-placement": "top-center",
        "data-mos-mirror": "true",
      });
      MOS.init({ offset: 300 });
      scrollTo(2500);
      expect(isShown(element)).toBe(true);

      // out = top + height - offset
      scrollTo(3000 + 100 - 300 - 1);
      expect(isShown(element)).toBe(true);
      scrollTo(3000 + 100 - 300);
      expect(isShown(element)).toBe(false);
    });
  });

  // ===================================================================
  // (o) REFRESH ON WINDOW LOAD
  // ===================================================================

  describe("refresh on window load", () => {
    afterEach(() => {
      restoreReadyState();
    });

    it("should recalculate positions when the page finishes loading after the start", () => {
      MOS.destroy();
      const element = addMosElement(2000);
      setReadyState("loading");
      MOS.init();
      document.dispatchEvent(new Event("DOMContentLoaded"));
      const controls = onlyControls(element);

      // Images above the element load and push it down
      place(element, 5000);
      window.dispatchEvent(new Event("load"));

      scrollTo(positionIn(2000));
      expect(isShown(element)).toBe(false);
      expect(controls.play).not.toHaveBeenCalled();

      scrollTo(positionIn(5000));
      expect(isShown(element)).toBe(true);
      expect(controls.play).toHaveBeenCalledTimes(1);
      // Same animation throughout, never paused again
      expect(onlyControls(element)).toBe(controls);
      expect(controls.pause).toHaveBeenCalledTimes(1);
    });

    it("should use stale positions until then (the load refresh is what fixes them)", () => {
      MOS.destroy();
      const element = addMosElement(2000);
      setReadyState("interactive");
      MOS.init();

      place(element, 5000);
      scrollTo(positionIn(2000));
      expect(isShown(element)).toBe(true);

      // and the refresh corrects it
      window.dispatchEvent(new Event("load"));
      expect(isShown(element)).toBe(false);
      expect(eventsOfType("mos:out", element)).toHaveLength(1);
    });

    it("should refresh only once, however often load fires", () => {
      MOS.destroy();
      const element = addMosElement(2000);
      setReadyState("loading");
      MOS.init();
      document.dispatchEvent(new Event("DOMContentLoaded"));
      window.dispatchEvent(new Event("load"));

      place(element, 5000);
      window.dispatchEvent(new Event("load"));

      // the second load event did not recalculate anything
      scrollTo(positionIn(2000));
      expect(isShown(element)).toBe(true);
    });

    it("should not start the library when load fires before a custom start event", () => {
      MOS.destroy();
      const element = addMosElement(100);
      setReadyState("loading");
      MOS.init({ startEvent: "app:ready" });

      window.dispatchEvent(new Event("load"));
      scrollTo(10);
      resize();

      expect(animateCount(element)).toBe(0);
      expect(element.className).toBe("");
      expect(events).toEqual([]);

      document.dispatchEvent(new Event("app:ready"));
      expect(element.className).toBe("mos-init mos-animate");
      expect(onlyControls(element).play).toHaveBeenCalledTimes(1);
      expect(events).toEqual([{ type: "mos:in", detail: element }]);
    });

    it("should not refresh on load after destroy()", () => {
      MOS.destroy();
      const element = addMosElement(100);
      setReadyState("loading");
      MOS.init();
      document.dispatchEvent(new Event("DOMContentLoaded"));
      const controls = onlyControls(element);
      MOS.destroy();
      const before = snapshot(controls);
      events.length = 0;

      window.dispatchEvent(new Event("load"));
      scrollTo(10);

      expect(snapshot(controls)).toEqual(before);
      expect(animateCount(element)).toBe(1);
      expect(events).toEqual([]);
    });

    it("should refresh only once on load when init() was called several times before the start", () => {
      MOS.destroy();
      const element = addMosElement(2000);
      setReadyState("loading");
      MOS.init();
      MOS.init({ once: true });
      MOS.init();
      document.dispatchEvent(new Event("DOMContentLoaded"));
      const controls = onlyControls(element);
      const classListAdd = vi.spyOn(element.classList, "add");

      window.dispatchEvent(new Event("load"));

      // one refresh re-adds the init class exactly once
      expect(classListAdd.mock.calls.filter(([name]) => name === "mos-init")).toHaveLength(1);
      expect(controls.pause).toHaveBeenCalledTimes(1);
      classListAdd.mockRestore();
    });
  });
});
