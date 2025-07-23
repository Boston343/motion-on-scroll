import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllElements,
  findPreparedElement,
  getMosElements,
  getPreparedElements,
  prepareElement,
  prepareElements,
  updatePreparedElements,
} from "../helpers/elements.js";
import type { ElementOptions, MosElement, MosOptions } from "../helpers/types.js";

// Mock the dependencies
vi.mock("../helpers/attributes.js", () => ({
  resolveElementOptions: vi.fn(),
}));

vi.mock("../helpers/position-calculator.js", () => ({
  getPositionIn: vi.fn(),
  getPositionOut: vi.fn(),
}));

import { resolveElementOptions } from "../helpers/attributes.js";
import { getPositionIn, getPositionOut } from "../helpers/position-calculator.js";

describe("elements.ts", () => {
  let mockElement1: HTMLElement;
  let mockElement2: HTMLElement;
  let mockOptions: MosOptions;
  let mockElementOptions: ElementOptions;

  beforeEach(() => {
    // Clear all elements before each test
    clearAllElements();

    // Create mock DOM elements
    mockElement1 = document.createElement("div");
    mockElement1.setAttribute("data-mos", "fade");
    mockElement1.setAttribute("id", "element1");

    mockElement2 = document.createElement("div");
    mockElement2.setAttribute("data-mos", "slide-up");
    mockElement2.setAttribute("id", "element2");

    // Mock options
    mockOptions = {
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
    };

    mockElementOptions = {
      ...mockOptions,
      keyframes: "fade",
    };

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(resolveElementOptions).mockReturnValue(mockElementOptions);
    vi.mocked(getPositionIn).mockReturnValue(100);
    vi.mocked(getPositionOut).mockReturnValue(200);

    // Mock document.querySelectorAll
    vi.spyOn(document, "querySelectorAll").mockReturnValue([
      mockElement1,
      mockElement2,
    ] as unknown as NodeListOf<HTMLElement>);
  });

  describe("getMosElements", () => {
    it("should query DOM when no prepared elements exist", () => {
      const result = getMosElements();

      expect(document.querySelectorAll).toHaveBeenCalledWith("[data-mos]");
      expect(result).toEqual([mockElement1, mockElement2]);
    });

    it("should query DOM when findNewElements is true", () => {
      // First prepare some elements
      prepareElements([mockElement1], mockOptions);

      const result = getMosElements(true);

      expect(document.querySelectorAll).toHaveBeenCalledWith("[data-mos]");
      expect(result).toEqual([mockElement1, mockElement2]);
    });

    it("should extract from prepared elements when available and findNewElements is false", () => {
      // Prepare elements first
      prepareElements([mockElement1, mockElement2], mockOptions);

      const result = getMosElements(false);

      // Should not query DOM again
      expect(document.querySelectorAll).toHaveBeenCalledTimes(0);
      expect(result).toEqual([mockElement1, mockElement2]);
    });

    it("should extract from prepared elements by default when available", () => {
      // Prepare elements first
      prepareElements([mockElement1], mockOptions);

      const result = getMosElements();

      // Should not query DOM again
      expect(document.querySelectorAll).toHaveBeenCalledTimes(0);
      expect(result).toEqual([mockElement1]);
    });
  });

  describe("prepareElements", () => {
    it("should prepare multiple elements successfully", () => {
      const result = prepareElements([mockElement1, mockElement2], mockOptions);

      expect(result).toHaveLength(2);
      expect(result[0].element).toBe(mockElement1);
      expect(result[1].element).toBe(mockElement2);
      expect(resolveElementOptions).toHaveBeenCalledTimes(2);
      expect(getPositionIn).toHaveBeenCalledTimes(2);
    });

    it("should clear previous prepared elements", () => {
      // First preparation
      prepareElements([mockElement1], mockOptions);
      expect(getPreparedElements()).toHaveLength(1);

      // Second preparation should clear and replace
      prepareElements([mockElement2], mockOptions);
      expect(getPreparedElements()).toHaveLength(1);
      expect(getPreparedElements()[0].element).toBe(mockElement2);
    });

    it("should filter out elements that fail to prepare", () => {
      const invalidElement = document.createElement("div");
      // No data-mos attribute

      const result = prepareElements([mockElement1, invalidElement, mockElement2], mockOptions);

      expect(result).toHaveLength(2);
      expect(result[0].element).toBe(mockElement1);
      expect(result[1].element).toBe(mockElement2);
    });

    it("should handle empty elements array", () => {
      const result = prepareElements([], mockOptions);

      expect(result).toEqual([]);
      expect(getPreparedElements()).toEqual([]);
    });
  });

  describe("prepareElement", () => {
    it("should prepare element with basic options", () => {
      const result = prepareElement(mockElement1, mockOptions);

      expect(result).toBeDefined();
      expect(result!.element).toBe(mockElement1);
      expect(result!.options).toBe(mockElementOptions);
      expect(result!.animated).toBe(false);
      expect(result!.isReversing).toBe(false);
      expect(result!.controls).toBeUndefined();
      expect(result!.position.in).toBe(100);
      expect(result!.position.out).toBe(false);
    });

    it("should return null for element without data-mos attribute", () => {
      const elementWithoutMos = document.createElement("div");

      const result = prepareElement(elementWithoutMos, mockOptions);

      expect(result).toBeNull();
    });

    it("should calculate out position when mirror is true and once is false", () => {
      const mirrorOptions: ElementOptions = {
        ...mockOptions,
        mirror: true,
        once: false,
        keyframes: "fade-up",
      };

      // Mock resolveElementOptions to return the mirror options
      vi.mocked(resolveElementOptions).mockReturnValueOnce(mirrorOptions);

      const result = prepareElement(mockElement1, mirrorOptions);

      expect(result!.position.out).toBe(200);
      expect(getPositionOut).toHaveBeenCalledWith(mockElement1, mirrorOptions);
    });

    it("should not calculate out position when mirror is false", () => {
      const result = prepareElement(mockElement1, mockOptions);

      expect(result!.position.out).toBe(false);
      expect(getPositionOut).not.toHaveBeenCalled();
    });

    it("should not calculate out position when once is true", () => {
      const onceOptions: MosOptions = {
        ...mockOptions,
        mirror: true,
        once: true,
      };

      const result = prepareElement(mockElement1, onceOptions);

      expect(result!.position.out).toBe(false);
      expect(getPositionOut).not.toHaveBeenCalled();
    });

    it("should call resolveElementOptions with correct parameters", () => {
      prepareElement(mockElement1, mockOptions);

      expect(resolveElementOptions).toHaveBeenCalledWith(mockElement1, mockOptions);
    });

    it("should call getPositionIn with correct parameters", () => {
      prepareElement(mockElement1, mockOptions);

      expect(getPositionIn).toHaveBeenCalledWith(mockElement1, mockElementOptions);
    });
  });

  describe("getPreparedElements", () => {
    it("should return empty array when no elements prepared", () => {
      const result = getPreparedElements();

      expect(result).toEqual([]);
    });

    it("should return all prepared elements", () => {
      prepareElements([mockElement1, mockElement2], mockOptions);

      const result = getPreparedElements();

      expect(result).toHaveLength(2);
      expect(result[0].element).toBe(mockElement1);
      expect(result[1].element).toBe(mockElement2);
    });
  });

  describe("findPreparedElement", () => {
    it("should find existing prepared element", () => {
      prepareElements([mockElement1, mockElement2], mockOptions);

      const result = findPreparedElement(mockElement1);

      expect(result).toBeDefined();
      expect(result!.element).toBe(mockElement1);
    });

    it("should return undefined for non-existent element", () => {
      prepareElements([mockElement1], mockOptions);
      const otherElement = document.createElement("div");

      const result = findPreparedElement(otherElement);

      expect(result).toBeUndefined();
    });

    it("should return undefined when no elements prepared", () => {
      const result = findPreparedElement(mockElement1);

      expect(result).toBeUndefined();
    });
  });

  describe("updatePreparedElements", () => {
    it("should update prepared elements array", () => {
      const mockMosElement: MosElement = {
        element: mockElement1,
        options: mockElementOptions,
        position: { in: 100, out: false },
        animated: false,
        isReversing: false,
        controls: undefined,
      };

      updatePreparedElements([mockMosElement]);

      const result = getPreparedElements();
      expect(result).toEqual([mockMosElement]);
    });

    it("should replace existing prepared elements", () => {
      // First prepare some elements
      prepareElements([mockElement1, mockElement2], mockOptions);
      expect(getPreparedElements()).toHaveLength(2);

      // Update with different elements
      const newMosElement: MosElement = {
        element: mockElement1,
        options: mockElementOptions,
        position: { in: 150, out: 250 },
        animated: true,
        isReversing: false,
        controls: undefined,
      };

      updatePreparedElements([newMosElement]);

      const result = getPreparedElements();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(newMosElement);
      expect(result[0].position.in).toBe(150);
      expect(result[0].animated).toBe(true);
    });

    it("should handle empty array", () => {
      prepareElements([mockElement1], mockOptions);
      expect(getPreparedElements()).toHaveLength(1);

      updatePreparedElements([]);

      expect(getPreparedElements()).toEqual([]);
    });
  });

  describe("clearAllElements", () => {
    it("should clear all prepared elements", () => {
      prepareElements([mockElement1, mockElement2], mockOptions);
      expect(getPreparedElements()).toHaveLength(2);

      clearAllElements();

      expect(getPreparedElements()).toEqual([]);
    });

    it("should work when no elements are prepared", () => {
      expect(getPreparedElements()).toEqual([]);

      clearAllElements();

      expect(getPreparedElements()).toEqual([]);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete workflow", () => {
      // 1. Get DOM elements
      const domElements = getMosElements();
      expect(domElements).toHaveLength(2);

      // 2. Prepare elements
      const prepared = prepareElements(domElements, mockOptions);
      expect(prepared).toHaveLength(2);

      // 3. Find specific element
      const found = findPreparedElement(mockElement1);
      expect(found).toBeDefined();
      expect(found!.element).toBe(mockElement1);

      // 4. Get all prepared
      const all = getPreparedElements();
      expect(all).toHaveLength(2);

      // 5. Clear all
      clearAllElements();
      expect(getPreparedElements()).toEqual([]);
    });

    it("should handle caching behavior correctly", () => {
      // First call queries DOM
      const elements1 = getMosElements();
      expect(document.querySelectorAll).toHaveBeenCalledTimes(1);

      // Prepare elements
      prepareElements(elements1, mockOptions);

      // Second call uses cache
      const elements2 = getMosElements();
      expect(document.querySelectorAll).toHaveBeenCalledTimes(1); // Still only called once
      expect(elements2).toEqual(elements1);

      // Force new query
      const elements3 = getMosElements(true);
      expect(document.querySelectorAll).toHaveBeenCalledTimes(2); // Now called twice
    });
  });
});
