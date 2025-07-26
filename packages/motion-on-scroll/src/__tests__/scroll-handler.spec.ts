import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanupScrollHandler,
  ensureScrollHandlerActive,
  evaluateElementPositions,
  updateScrollHandlerDelays,
} from "../helpers/scroll-handler.js";
import type { MosElement } from "../helpers/types.js";

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

describe("scroll-handler.ts", () => {
  let mockElement1: HTMLElement;
  let mockElement2: HTMLElement;
  let mockMosElement1: MosElement;
  let mockMosElement2: MosElement;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create mock DOM elements
    mockElement1 = document.createElement("div");
    mockElement1.setAttribute("data-mos", "fade");
    mockElement1.setAttribute("id", "element1");

    mockElement2 = document.createElement("div");
    mockElement2.setAttribute("data-mos", "slide-up");
    mockElement2.setAttribute("id", "element2");

    // Create mock MosElement objects
    mockMosElement1 = {
      element: mockElement1,
      options: {
        duration: 400,
        easing: "ease",
        delay: 0,
        once: true,
        mirror: false,
        offset: 120,
        disable: false,
        startEvent: "DOMContentLoaded",
        throttleDelay: 99,
        debounceDelay: 50,
        timeUnits: "ms",
        distance: 100,
        disableMutationObserver: false,
        keyframes: "fade",
      },
      position: { in: 100, out: false },
      animated: false,
      isReversing: false,
      controls: undefined,
    };

    mockMosElement2 = {
      element: mockElement2,
      options: {
        duration: 600,
        easing: "ease-out",
        delay: 100,
        once: false,
        mirror: true,
        offset: 150,
        disable: false,
        startEvent: "DOMContentLoaded",
        throttleDelay: 99,
        debounceDelay: 50,
        timeUnits: "ms",
        distance: 200,
        disableMutationObserver: false,
        keyframes: "slide-up",
      },
      position: { in: 200, out: 400 },
      animated: false,
      isReversing: false,
      controls: undefined,
    };

    // Setup spies for window event listeners
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    // Mock window.scrollY
    Object.defineProperty(window, "scrollY", {
      value: 0,
      writable: true,
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(getPreparedElements).mockReturnValue([]);
    vi.mocked(getPositionIn).mockReturnValue(100);
    vi.mocked(getPositionOut).mockReturnValue(200);
    vi.mocked(isElementAboveViewport).mockReturnValue(false);

    // Clean up any existing scroll handlers
    cleanupScrollHandler();
  });

  describe("updateScrollHandlerDelays", () => {
    it("should update the throttle delay", () => {
      updateScrollHandlerDelays(150);

      // Ensure scroll handler is active to test the delay is applied
      ensureScrollHandlerActive();

      expect(throttle).toHaveBeenCalledWith(expect.any(Function), 150);
    });

    it("should apply new delay when scroll handler is reinitialized", () => {
      // Reset to default delay first
      updateScrollHandlerDelays(99);
      vi.clearAllMocks();

      // First initialization with default delay
      ensureScrollHandlerActive();
      expect(throttle).toHaveBeenCalledWith(expect.any(Function), 99);

      // Cleanup and update delay
      cleanupScrollHandler();
      updateScrollHandlerDelays(200);
      vi.clearAllMocks();

      // Reinitialize with new delay
      ensureScrollHandlerActive();
      expect(throttle).toHaveBeenCalledWith(expect.any(Function), 200);
    });
  });

  describe("ensureScrollHandlerActive", () => {
    it("should set up scroll event listener", () => {
      ensureScrollHandlerActive();

      expect(addEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function), {
        passive: true,
      });
    });

    it("should create throttled scroll handler", () => {
      // Reset to default delay first
      updateScrollHandlerDelays(99);
      vi.clearAllMocks();

      ensureScrollHandlerActive();

      expect(throttle).toHaveBeenCalledWith(expect.any(Function), 99);
    });

    it("should prevent multiple initializations", () => {
      ensureScrollHandlerActive();
      ensureScrollHandlerActive();
      ensureScrollHandlerActive();

      // Should only be called once
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(throttle).toHaveBeenCalledTimes(1);
    });

    it("should allow reinitialization after cleanup", () => {
      ensureScrollHandlerActive();
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

      cleanupScrollHandler();
      ensureScrollHandlerActive();

      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("cleanupScrollHandler", () => {
    it("should remove scroll event listener when active", () => {
      ensureScrollHandlerActive();
      const scrollHandler = addEventListenerSpy.mock.calls[0][1];

      cleanupScrollHandler();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", scrollHandler);
    });

    it("should do nothing when no active handler", () => {
      cleanupScrollHandler();

      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });

    it("should allow multiple cleanup calls safely", () => {
      ensureScrollHandlerActive();
      cleanupScrollHandler();
      cleanupScrollHandler();
      cleanupScrollHandler();

      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("evaluateElementPositions", () => {
    beforeEach(() => {
      vi.mocked(getPreparedElements).mockReturnValue([mockMosElement1, mockMosElement2]);
    });

    it("should recalculate positions for all elements", () => {
      evaluateElementPositions();

      expect(getPositionIn).toHaveBeenCalledWith(mockElement1, mockMosElement1.options);
      expect(getPositionIn).toHaveBeenCalledWith(mockElement2, mockMosElement2.options);
    });

    it("should calculate out positions for mirror elements", () => {
      evaluateElementPositions();

      // mockMosElement1 has mirror: false, so no out position
      expect(getPositionOut).not.toHaveBeenCalledWith(mockElement1, expect.anything());

      // mockMosElement2 has mirror: true and once: false, so should calculate out position
      expect(getPositionOut).toHaveBeenCalledWith(mockElement2, mockMosElement2.options);
    });

    it("should set initial states for all elements", () => {
      evaluateElementPositions();

      expect(isElementAboveViewport).toHaveBeenCalledWith(mockElement1);
      expect(isElementAboveViewport).toHaveBeenCalledWith(mockElement2);
    });

    it("should set final state for elements above viewport (non-mirror)", () => {
      vi.mocked(isElementAboveViewport).mockImplementation((el) => el === mockElement1);

      evaluateElementPositions();

      expect(setFinalState).toHaveBeenCalledWith(mockMosElement1);
      expect(setInitialState).toHaveBeenCalledWith(mockMosElement2);
    });

    it("should set initial state for elements above viewport (mirror)", () => {
      const mirrorElement = {
        ...mockMosElement1,
        options: { ...mockMosElement1.options, mirror: true },
      };
      vi.mocked(getPreparedElements).mockReturnValue([mirrorElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(true);

      evaluateElementPositions();

      expect(setInitialState).toHaveBeenCalledWith(mirrorElement);
      expect(setFinalState).not.toHaveBeenCalled();
    });

    it("should process current scroll position after setup", () => {
      window.scrollY = 150;
      mockMosElement1.position.in = 100; // Should trigger animation
      vi.mocked(getPreparedElements).mockReturnValue([mockMosElement1]);

      evaluateElementPositions();

      // Should trigger play since scrollY (150) >= position.in (100)
      expect(play).toHaveBeenCalledWith(mockMosElement1);
    });

    it("should preserve animated element states during resize (flicker fix)", () => {
      // Setup: Create elements with different animation states
      const animatedElement = {
        ...mockMosElement1,
        animated: true, // Already animated
      };
      const nonAnimatedElement = {
        ...mockMosElement2,
        animated: false, // Not yet animated
      };

      vi.mocked(getPreparedElements).mockReturnValue([animatedElement, nonAnimatedElement]);
      vi.mocked(isElementAboveViewport).mockReturnValue(false);

      evaluateElementPositions();

      // Should recalculate positions for both elements
      expect(getPositionIn).toHaveBeenCalledWith(animatedElement.element, animatedElement.options);
      expect(getPositionIn).toHaveBeenCalledWith(
        nonAnimatedElement.element,
        nonAnimatedElement.options,
      );

      // Should NOT reset initial state for already-animated element (prevents flicker)
      expect(setInitialState).not.toHaveBeenCalledWith(animatedElement);
      expect(setFinalState).not.toHaveBeenCalledWith(animatedElement);

      // Should still set initial state for non-animated element
      expect(setInitialState).toHaveBeenCalledWith(nonAnimatedElement);
    });
  });

  describe("scroll event processing", () => {
    beforeEach(() => {
      ensureScrollHandlerActive();
      vi.mocked(getPreparedElements).mockReturnValue([mockMosElement1, mockMosElement2]);
    });

    it("should trigger show animation when scrolling past entry point", () => {
      window.scrollY = 150;
      mockMosElement1.position.in = 100;
      mockMosElement1.animated = false;

      // Simulate scroll event
      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      expect(play).toHaveBeenCalledWith(mockMosElement1);
    });

    it("should not trigger show animation if already animated", () => {
      window.scrollY = 150;
      mockMosElement1.position.in = 100;
      mockMosElement1.animated = true;
      mockMosElement1.isReversing = false;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      expect(play).not.toHaveBeenCalled();
    });

    it("should trigger show animation if currently reversing", () => {
      window.scrollY = 150;
      mockMosElement1.position.in = 100;
      mockMosElement1.animated = true;
      mockMosElement1.isReversing = true;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      expect(play).toHaveBeenCalledWith(mockMosElement1);
    });

    it("should trigger hide animation with mirror when scrolling past exit point", () => {
      window.scrollY = 450;
      mockMosElement2.position.out = 400;
      mockMosElement2.animated = true;
      mockMosElement2.isReversing = false;
      mockMosElement2.options.mirror = true;
      mockMosElement2.options.once = false;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      expect(reverse).toHaveBeenCalledWith(mockMosElement2);
    });

    it("should not trigger hide animation if already reversing", () => {
      window.scrollY = 450;
      mockMosElement2.position.out = 400;
      mockMosElement2.animated = true;
      mockMosElement2.isReversing = true;
      mockMosElement2.options.mirror = true;
      mockMosElement2.options.once = false;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      expect(reverse).not.toHaveBeenCalled();
    });

    it("should not trigger hide animation if not animated", () => {
      window.scrollY = 450;
      mockMosElement2.position.out = 400;
      mockMosElement2.animated = false;
      mockMosElement2.options.mirror = true;
      mockMosElement2.options.once = false;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      expect(reverse).not.toHaveBeenCalled();
    });

    it("should trigger hide animation when scrolling back before entry point (non-once)", () => {
      window.scrollY = 50;
      mockMosElement2.position.in = 100;
      mockMosElement2.animated = true;
      mockMosElement2.isReversing = false;
      mockMosElement2.options.once = false;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      expect(reverse).toHaveBeenCalledWith(mockMosElement2);
    });

    it("should not trigger hide animation for once elements", () => {
      window.scrollY = 50;
      mockMosElement1.position.in = 100;
      mockMosElement1.animated = true;
      mockMosElement1.isReversing = false;
      mockMosElement1.options.once = true;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      expect(reverse).not.toHaveBeenCalled();
    });

    it("should handle elements with undefined positions", () => {
      window.scrollY = 150;
      mockMosElement1.position.in = undefined as any;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;

      // Should not throw an error
      expect(() => scrollHandler()).not.toThrow();
    });

    it("should handle elements with false out positions", () => {
      window.scrollY = 450;
      mockMosElement1.position.out = false;
      mockMosElement1.options.mirror = true;
      mockMosElement1.options.once = false;

      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      // Should not trigger reverse since out position is false
      expect(reverse).not.toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete lifecycle", () => {
      // 1. Update delays
      updateScrollHandlerDelays(120);

      // 2. Ensure handler is active
      ensureScrollHandlerActive();
      expect(addEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function), {
        passive: true,
      });

      // 3. Evaluate positions
      vi.mocked(getPreparedElements).mockReturnValue([mockMosElement1]);
      evaluateElementPositions();
      expect(getPositionIn).toHaveBeenCalled();

      // 4. Cleanup
      cleanupScrollHandler();
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it("should handle multiple elements with different configurations", () => {
      const elements = [
        mockMosElement1, // once: true, mirror: false
        mockMosElement2, // once: false, mirror: true
      ];
      vi.mocked(getPreparedElements).mockReturnValue(elements);
      ensureScrollHandlerActive();

      // Scroll to trigger different behaviors
      window.scrollY = 250;
      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;
      scrollHandler();

      // Both elements should trigger show animations
      expect(play).toHaveBeenCalledWith(mockMosElement1);
      expect(play).toHaveBeenCalledWith(mockMosElement2);
    });

    it("should maintain state across multiple scroll events", () => {
      vi.mocked(getPreparedElements).mockReturnValue([mockMosElement1]);
      ensureScrollHandlerActive();
      const scrollHandler = addEventListenerSpy.mock.calls[0][1] as () => void;

      // First scroll - trigger animation
      window.scrollY = 150;
      mockMosElement1.position.in = 100;
      mockMosElement1.animated = false;
      scrollHandler();
      expect(play).toHaveBeenCalledTimes(1);

      // Second scroll - element now animated, shouldn't trigger again
      vi.clearAllMocks();
      mockMosElement1.animated = true;
      scrollHandler();
      expect(play).not.toHaveBeenCalled();
    });
  });
});
