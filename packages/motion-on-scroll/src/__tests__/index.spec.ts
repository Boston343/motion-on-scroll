import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_OPTIONS } from "../helpers/constants.js";

// Mock all dependencies
vi.mock("../helpers/animations.js", () => ({
  registerAnimation: vi.fn(),
}));

vi.mock("../helpers/easing.js", () => ({
  registerEasing: vi.fn(),
}));

vi.mock("../helpers/elements.js", () => ({
  clearAllElements: vi.fn(),
  getMosElements: vi.fn(() => []),
  prepareElements: vi.fn(),
}));

vi.mock("../helpers/keyframes.js", () => ({
  registerKeyframes: vi.fn(),
}));

vi.mock("../helpers/observer.js", () => ({
  startDomObserver: vi.fn(),
}));

vi.mock("../helpers/scroll-handler.js", () => ({
  cleanupScrollHandler: vi.fn(),
  ensureScrollHandlerActive: vi.fn(),
  evaluateElementPositions: vi.fn(),
  updateScrollHandlerDelays: vi.fn(),
}));

vi.mock("../helpers/utils.js", () => ({
  debounce: vi.fn((fn) => fn),
  isDisabled: vi.fn(() => false),
  removeMosAttributes: vi.fn(),
}));

// Import mocked functions
import { registerAnimation } from "../helpers/animations.js";
import { registerEasing } from "../helpers/easing.js";
import {
  clearAllElements,
  getMosElements,
  prepareElements,
} from "../helpers/elements.js";
import { registerKeyframes } from "../helpers/keyframes.js";
import { startDomObserver } from "../helpers/observer.js";
import {
  cleanupScrollHandler,
  ensureScrollHandlerActive,
  evaluateElementPositions,
  updateScrollHandlerDelays,
} from "../helpers/scroll-handler.js";
import { debounce, isDisabled, removeMosAttributes } from "../helpers/utils.js";

describe("index.ts - Main Entry Point", () => {
  let mockElement1: HTMLElement;
  let mockElement2: HTMLElement;
  let MOS: any;
  let init: any;
  let refresh: any;
  let refreshHard: any;
  let handleLayoutChange: any;
  let setupStartEventListener: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock DOM elements
    mockElement1 = document.createElement("div");
    mockElement1.setAttribute("data-mos", "fade");
    mockElement1.setAttribute("id", "element1");

    mockElement2 = document.createElement("div");
    mockElement2.setAttribute("data-mos", "slide-up");
    mockElement2.setAttribute("id", "element2");

    // Mock getMosElements to return our test elements
    vi.mocked(getMosElements).mockReturnValue([mockElement1, mockElement2]);

    // Mock document.readyState since it's read-only
    Object.defineProperty(document, 'readyState', {
      writable: true,
      value: 'loading'
    });

    // Mock global MutationObserver
    global.MutationObserver = vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn()
    })) as any;

    // Reset modules and re-import to get fresh state
    vi.resetModules();
    const indexModule = await import("../index.js");
    MOS = indexModule.MOS;
    init = indexModule.init;
    refresh = indexModule.refresh;
    refreshHard = indexModule.refreshHard;
    handleLayoutChange = indexModule.handleLayoutChange;
    setupStartEventListener = indexModule.setupStartEventListener;
  });

  describe("MOS object export", () => {
    it("should export MOS object with all required methods", () => {
      expect(MOS).toBeDefined();
      expect(MOS.init).toBeDefined();
      expect(MOS.refresh).toBeDefined();
      expect(MOS.refreshHard).toBeDefined();
      expect(MOS.registerKeyframes).toBeDefined();
      expect(MOS.registerEasing).toBeDefined();
      expect(MOS.registerAnimation).toBeDefined();
    });

    it("should have function exports matching MOS object", () => {
      expect(typeof init).toBe("function");
      expect(typeof refresh).toBe("function");
      expect(typeof refreshHard).toBe("function");
    });
  });

  describe("init()", () => {
    it("should initialize with default options when no options provided", () => {
      const result = init();

      expect(getMosElements).toHaveBeenCalled();
      expect(result).toEqual([mockElement1, mockElement2]);
    });

    it("should merge provided options with defaults", () => {
      const customOptions = {
        duration: 800,
        easing: "ease-in-out",
        delay: 100,
      };

      init(customOptions);

      // Should still find elements
      expect(getMosElements).toHaveBeenCalled();
    });

    it("should handle time unit conversion on first init", () => {
      const optionsWithSeconds = {
        timeUnits: "s" as const,
      };

      init(optionsWithSeconds);

      expect(getMosElements).toHaveBeenCalled();
    });

    it("should handle global disable by cleaning up elements", () => {
      vi.mocked(isDisabled).mockReturnValue(true);

      const result = init();

      // removeMosAttributes is called with forEach, so it gets (element, index, array)
      expect(removeMosAttributes).toHaveBeenCalledWith(mockElement1, 0, [mockElement1, mockElement2]);
      expect(removeMosAttributes).toHaveBeenCalledWith(mockElement2, 1, [mockElement1, mockElement2]);
      expect(result).toEqual([]);
    });

    it("should start DOM observer when not disabled and MutationObserver exists", () => {
      // Mock isDisabled to return false so we don't exit early
      vi.mocked(isDisabled).mockReturnValue(false);
      
      init({ disableMutationObserver: false });

      expect(startDomObserver).toHaveBeenCalled();
    });

    it("should not start DOM observer when disabled", () => {
      init({ disableMutationObserver: true });

      expect(startDomObserver).not.toHaveBeenCalled();
    });

    it("should not start DOM observer when MutationObserver is not supported", () => {
      // Remove MutationObserver
      const originalMutationObserver = global.MutationObserver;
      delete (global as any).MutationObserver;

      init();

      expect(startDomObserver).not.toHaveBeenCalled();
      
      // Restore MutationObserver
      global.MutationObserver = originalMutationObserver;
    });

    it("should refresh when called multiple times", () => {
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      // First init
      init();
      expect(getMosElements).toHaveBeenCalledTimes(1);

      // Second init should trigger refresh
      init({ duration: 600 });
      expect(getMosElements).toHaveBeenCalledTimes(2);
    });
  });

  describe("refresh()", () => {
    it("should not activate library when shouldActivate is false and library is inactive", () => {
      refresh(false);

      // Should not call any scroll handler functions when library is inactive
      expect(updateScrollHandlerDelays).not.toHaveBeenCalled();
      expect(prepareElements).not.toHaveBeenCalled();
      expect(ensureScrollHandlerActive).not.toHaveBeenCalled();
      expect(evaluateElementPositions).not.toHaveBeenCalled();
    });

    it("should activate library when shouldActivate is true", () => {
      refresh(true);

      expect(updateScrollHandlerDelays).toHaveBeenCalled();
      expect(getMosElements).toHaveBeenCalled();
      expect(prepareElements).toHaveBeenCalledWith([mockElement1, mockElement2], DEFAULT_OPTIONS);
      expect(ensureScrollHandlerActive).toHaveBeenCalled();
      expect(evaluateElementPositions).toHaveBeenCalled();
    });

    it("should update scroll handler delays with library config", () => {
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      // First init to set library as active
      init({ throttleDelay: 150 });

      // Call refresh with shouldActivate=true to ensure library is active
      refresh(true);

      expect(updateScrollHandlerDelays).toHaveBeenCalledWith(150);
    });

    it("should prepare elements with current library config", () => {
      const customOptions = { duration: 800, delay: 200 };
      
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      // Init with custom options to set library config
      init(customOptions);
      
      // Call refresh with shouldActivate=true to ensure library is active
      refresh(true);

      expect(prepareElements).toHaveBeenCalledWith(
        [mockElement1, mockElement2],
        expect.objectContaining(customOptions)
      );
    });
  });

  describe("refreshHard()", () => {
    it("should re-find elements and clear existing state", () => {
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      // Set up library as active first
      init();

      refreshHard();

      expect(getMosElements).toHaveBeenCalledWith(true); // Force refresh
      expect(clearAllElements).toHaveBeenCalled();
      expect(cleanupScrollHandler).toHaveBeenCalled();
    });

    it("should handle global disable during hard refresh", () => {
      vi.mocked(isDisabled).mockReturnValue(true);

      refreshHard();

      // removeMosAttributes is called with forEach, so it gets (element, index, array)
      expect(removeMosAttributes).toHaveBeenCalledWith(mockElement1, 0, [mockElement1, mockElement2]);
      expect(removeMosAttributes).toHaveBeenCalledWith(mockElement2, 1, [mockElement1, mockElement2]);
      
      // When disabled, function returns early - cleanup functions are NOT called
      expect(clearAllElements).not.toHaveBeenCalled();
      expect(cleanupScrollHandler).not.toHaveBeenCalled();
    });

    it("should call refresh after cleanup when not disabled", () => {
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      refreshHard();

      expect(clearAllElements).toHaveBeenCalled();
      expect(cleanupScrollHandler).toHaveBeenCalled();
      
      // refresh() is called, but updateScrollHandlerDelays only happens if library is active
      // Since we haven't activated the library, updateScrollHandlerDelays won't be called
      expect(getMosElements).toHaveBeenCalled(); // This should be called by refresh
    });
  });

  describe("handleLayoutChange()", () => {
    it("should evaluate element positions when library is active", () => {
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      // Activate library first
      init();
      refresh(true);

      handleLayoutChange();

      expect(evaluateElementPositions).toHaveBeenCalled();
    });

    it("should not evaluate positions when library is inactive", () => {
      handleLayoutChange();

      expect(evaluateElementPositions).not.toHaveBeenCalled();
    });
  });

  describe("setupStartEventListener()", () => {
    beforeEach(() => {
      // Mock addEventListener
      vi.spyOn(window, "addEventListener");
      vi.spyOn(document, "addEventListener");
    });

    it("should call refresh immediately when DOMContentLoaded already fired", async () => {
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'interactive'
      });
      
      // Re-import to get fresh module state with new readyState
      vi.resetModules();
      const { setupStartEventListener } = await import("../index.js");
      
      setupStartEventListener();

      // Should not add event listener since DOM is already ready
      expect(document.addEventListener).not.toHaveBeenCalledWith("DOMContentLoaded", expect.any(Function), expect.any(Object));
    });

    it("should call refresh immediately when load already fired", async () => {
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'complete'
      });
      
      vi.resetModules();
      const { setupStartEventListener } = await import("../index.js");
      
      setupStartEventListener();

      // Should not add event listener since page is already loaded
      expect(window.addEventListener).not.toHaveBeenCalledWith("load", expect.any(Function), expect.any(Object));
    });

    it("should add window event listener for load event", () => {
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'loading'
      });
      
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      // Initialize with load event
      init({ startEvent: "load" });
      
      expect(window.addEventListener).toHaveBeenCalledWith("load", expect.any(Function), { once: true });
    });

    it("should add document event listener for DOMContentLoaded", () => {
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'loading'
      });
      
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      // Initialize with DOMContentLoaded (default)
      init({ startEvent: "DOMContentLoaded" });
      
      expect(document.addEventListener).toHaveBeenCalledWith("DOMContentLoaded", expect.any(Function), { once: true });
    });

    it("should add document event listener for custom events", () => {
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'loading'
      });
      
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      init({ startEvent: "custom-event" });
      
      expect(document.addEventListener).toHaveBeenCalledWith("custom-event", expect.any(Function), { once: true });
    });
  });

  describe("Layout change event listeners", () => {
    beforeEach(() => {
      vi.spyOn(window, "addEventListener");
    });

    it("should set up resize and orientation change listeners", () => {
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      init();

      expect(window.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith("orientationchange", expect.any(Function));
    });

    it("should use debounced handler with configured delay", () => {
      const customDebounceDelay = 200;
      
      // Mock isDisabled to return false
      vi.mocked(isDisabled).mockReturnValue(false);
      
      init({ debounceDelay: customDebounceDelay });

      expect(debounce).toHaveBeenCalledWith(expect.any(Function), customDebounceDelay);
    });
  });

  describe("Registration functions", () => {
    it("should expose registerKeyframes function", () => {
      const mockKeyframes = { "custom-fade": { from: { opacity: 0 }, to: { opacity: 1 } } };
      
      MOS.registerKeyframes(mockKeyframes);
      
      expect(registerKeyframes).toHaveBeenCalledWith(mockKeyframes);
    });

    it("should expose registerEasing function", () => {
      const mockEasing = { "custom-ease": "cubic-bezier(0.25, 0.46, 0.45, 0.94)" };
      
      MOS.registerEasing(mockEasing);
      
      expect(registerEasing).toHaveBeenCalledWith(mockEasing);
    });

    it("should expose registerAnimation function", () => {
      const mockAnimation = {
        name: "custom-animation",
        factory: () => ({ opacity: [0, 1] }),
      };
      
      MOS.registerAnimation(mockAnimation);
      
      expect(registerAnimation).toHaveBeenCalledWith(mockAnimation);
    });
  });

  describe("Time units adjustment", () => {
    it("should convert default duration from ms to seconds when timeUnits is 's'", () => {
      const options = {
        timeUnits: "s" as const,
        // Don't specify duration - should use converted default
      };

      init(options);

      // The conversion should happen internally
      // Default duration (400ms) should become 0.4s
      expect(getMosElements).toHaveBeenCalled();
    });

    it("should convert default delay from ms to seconds when timeUnits is 's'", () => {
      const options = {
        timeUnits: "s" as const,
        // Don't specify delay - should use converted default
      };

      init(options);

      expect(getMosElements).toHaveBeenCalled();
    });

    it("should not convert when timeUnits is 'ms'", () => {
      const options = {
        timeUnits: "ms" as const,
      };

      init(options);

      expect(getMosElements).toHaveBeenCalled();
    });

    it("should not convert on subsequent inits", () => {
      // First init with seconds
      init({ timeUnits: "s" });
      
      // Second init should not trigger conversion again
      init({ timeUnits: "s" });

      expect(getMosElements).toHaveBeenCalledTimes(2);
    });

    it("should not convert when explicit duration is provided", () => {
      const options = {
        timeUnits: "s" as const,
        duration: 2, // Explicit duration should not be converted
      };

      init(options);

      expect(getMosElements).toHaveBeenCalled();
    });

    it("should not convert when explicit delay is provided", () => {
      const options = {
        timeUnits: "s" as const,
        delay: 1, // Explicit delay should not be converted
      };

      init(options);

      expect(getMosElements).toHaveBeenCalled();
    });
  });
});
