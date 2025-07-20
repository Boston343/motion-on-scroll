/**
 * Custom scroll handler based on AOS approach
 * Replaces Motion's inView with direct scroll event handling
 */

import { play, reverse, setFinalState, setInitialState } from "./animations.js";
import { DEFAULT_OPTIONS } from "./constants.js";
import { getPositionIn, getPositionOut, isElementAboveViewport } from "./position-calculator.js";
import { getScrollDirection } from "./scroll-tracker.js";
import type { ElementOptions } from "./types.js";
import { debounce, throttle } from "./utils.js";

export interface MosElement {
  element: HTMLElement;
  options: ElementOptions;
  position: {
    in: number;
    out: number | false;
  };
  animated: boolean;
  isReversing: boolean;
}

// Global state
let mosElements: MosElement[] = [];
let scrollHandler: ((...args: any[]) => void) | null = null;
let currentThrottleDelay = DEFAULT_OPTIONS.throttleDelay;
let currentDebounceDelay = DEFAULT_OPTIONS.debounceDelay;

/**
 * Apply animation state based on scroll position (AOS-like logic)
 */
function applyAnimationState(mosEl: MosElement, scrollY: number): void {
  const { element, options, position } = mosEl;

  const hide = () => {
    if (!mosEl.animated || mosEl.isReversing) return;
    reverse(element, () => {
      // Callback: sync scroll handler state when reverse completes
      mosEl.animated = false;
      mosEl.isReversing = false;
    });
    // Keep animated = true during reverse for smooth transition
    mosEl.isReversing = true;
  };

  const show = () => {
    if (mosEl.animated && !mosEl.isReversing) return;
    play(element, options);
    mosEl.animated = true;
    mosEl.isReversing = false;
  };

  // AOS-like logic: mirror functionality with proper viewport handling
  if (options.mirror && position.out !== false && scrollY >= position.out && !options.once) {
    // Element is past its exit point and mirror is enabled
    hide();
  } else if (scrollY >= position.in) {
    // Element has reached its entry point
    show();
  } else if (mosEl.animated && !options.once) {
    // Element is before its entry point and was previously animated
    hide();
  }
}

/**
 * Main scroll handler - processes all elements
 */
function handleScroll(): void {
  const scrollY = window.scrollY;
  mosElements.forEach((mosEl) => applyAnimationState(mosEl, scrollY));
}

/**
 * Prepare elements with position calculations and initial states
 */
function prepareElements(): void {
  mosElements.forEach((mosEl) => {
    const { element, options } = mosEl;

    // Calculate trigger positions based on natural element position (AOS-like)
    mosEl.position = {
      in: getPositionIn(element, options),
      out: options.mirror && !options.once ? getPositionOut(element, options) : false,
    };

    // Set initial state based on element position (AOS-like)
    if (isElementAboveViewport(element)) {
      // Element is above viewport - set to final state immediately
      setFinalState(element, options);
      mosEl.animated = true;
    } else {
      // Element is in or below viewport - set to initial state
      setInitialState(element, options);
      mosEl.animated = false;
    }

    mosEl.isReversing = false;
  });

  // After preparing all elements, trigger scroll handler to animate elements currently in viewport
  handleScroll();
}

/**
 * Recalculate positions (for resize/orientation change)
 */
function recalculatePositions(): void {
  mosElements.forEach((mosEl) => {
    const { element, options } = mosEl;
    mosEl.position = {
      in: getPositionIn(element, options),
      out: options.mirror && !options.once ? getPositionOut(element, options) : false,
    };
  });

  // Trigger scroll handler to update states
  handleScroll();
}

/**
 * Update throttle and debounce delays (called from main init)
 */
export function updateScrollHandlerDelays(throttleDelay: number, debounceDelay: number): void {
  currentThrottleDelay = throttleDelay;
  currentDebounceDelay = debounceDelay;
}

/**
 * Add element to scroll observation
 */
export function observeElement(element: HTMLElement, options: ElementOptions): void {
  // Update delays from options if available
  updateScrollHandlerDelays(
    options.throttleDelay ?? DEFAULT_OPTIONS.throttleDelay,
    options.debounceDelay ?? DEFAULT_OPTIONS.debounceDelay,
  );

  // Check if element is already being observed
  const existingIndex = mosElements.findIndex((mosEl) => mosEl.element === element);
  if (existingIndex !== -1) {
    // Update existing element options
    const existingElement = mosElements[existingIndex]!; // Non-null assertion since we know it exists
    existingElement.options = options;
  } else {
    // Add new element
    mosElements.push({
      element,
      options,
      position: { in: 0, out: false },
      animated: false,
      isReversing: false,
    });
  }

  // Initialize scroll handler if not already done
  initializeScrollHandler();
}

/**
 * Remove element from scroll observation
 */
export function unobserveElement(element: HTMLElement): void {
  const index = mosElements.findIndex((mosEl) => mosEl.element === element);
  if (index !== -1) {
    mosElements.splice(index, 1);
  }
}

/**
 * Initialize scroll handler with throttling and debouncing
 */
function initializeScrollHandler(): void {
  if (scrollHandler) return; // Already initialized

  const throttledHandler = throttle(handleScroll, currentThrottleDelay);
  const debouncedRecalculate = debounce(recalculatePositions, currentDebounceDelay);

  // Add scroll listener
  window.addEventListener("scroll", throttledHandler, { passive: true });

  // Add resize and orientation change listeners
  window.addEventListener("resize", debouncedRecalculate);
  window.addEventListener("orientationchange", debouncedRecalculate);

  scrollHandler = throttledHandler;

  // Initial scroll check
  handleScroll();
}

/**
 * Clean up scroll handler
 */
export function cleanupScrollHandler(): void {
  if (scrollHandler) {
    window.removeEventListener("scroll", scrollHandler);
    window.removeEventListener("resize", recalculatePositions);
    window.removeEventListener("orientationchange", recalculatePositions);
    scrollHandler = null;
  }
  mosElements = [];
}

/**
 * Refresh all elements (recalculate positions and states)
 */
export function refreshElements(): void {
  prepareElements();
  handleScroll();
}
