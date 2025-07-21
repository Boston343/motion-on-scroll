// ===================================================================
// SCROLL-BASED ANIMATION HANDLER
// ===================================================================
// This module handles scroll-based animation triggering using a custom
// AOS-style approach. It replaces Motion's inView with direct scroll
// event handling for better control over animation timing and state.

import { play, reverse, setFinalState, setInitialState } from "./animations.js";
import { DEFAULT_OPTIONS } from "./constants.js";
import { getPreparedElements } from "./elements.js";
import { getPositionIn, getPositionOut, isElementAboveViewport } from "./position-calculator.js";
import type { ElementOptions, MosElement } from "./types.js";
import { debounce, throttle } from "./utils.js";

// ===================================================================
// MODULE STATE
// ===================================================================

/**
 * Reference to the active scroll event handler (for cleanup)
 */
let activeScrollHandler: ((...args: any[]) => void) | null = null;

/**
 * Reference to the active (debounced) resize/orientation handler (for cleanup)
 */
let activeResizeHandler: ((...args: any[]) => void) | null = null;

/**
 * Current throttle delay for scroll events (configurable)
 */
let currentThrottleDelay = DEFAULT_OPTIONS.throttleDelay;

/**
 * Current debounce delay for resize events (configurable)
 */
let currentDebounceDelay = DEFAULT_OPTIONS.debounceDelay;

// ===================================================================
// ANIMATION STATE MANAGEMENT
// ===================================================================

/**
 * Determines and applies the correct animation state based on scroll position
 * Uses AOS-like logic with support for mirror functionality
 * @param elementData - The element data containing state and configuration
 * @param scrollY - Current vertical scroll position
 */
function updateElementAnimationState(elementData: MosElement, scrollY: number): void {
  const { element, options, position } = elementData;

  /**
   * Hides the element by reversing its animation
   * Only triggers if element is currently animated and not already reversing
   */
  const hideElement = (): void => {
    if (!elementData.animated || elementData.isReversing) return;

    // Start reverse animation with completion callback
    reverse(element, () => {
      // Sync state when reverse animation completes
      elementData.animated = false;
      elementData.isReversing = false;
    });

    // Mark as reversing immediately for state tracking
    elementData.isReversing = true;
  };

  /**
   * Shows the element by playing its animation
   * Only triggers if element is not already animated or is currently reversing
   */
  const showElement = (): void => {
    if (elementData.animated && !elementData.isReversing) return;

    // Start forward animation
    play(element, options);
    elementData.animated = true;
    elementData.isReversing = false;
  };

  if (
    options.mirror &&
    position.out !== undefined &&
    position.out !== false &&
    scrollY >= position.out &&
    !options.once
  ) {
    hideElement();
  } else if (position.in !== undefined && scrollY >= position.in) {
    showElement();
  } else if (elementData.animated && !options.once) {
    hideElement();
  }
}

// ===================================================================
// SCROLL EVENT HANDLING
// ===================================================================

/**
 * Main scroll event handler that processes all tracked elements
 * Called on every scroll event (throttled for performance)
 */
function processScrollEvent(): void {
  const currentScrollY = window.scrollY;

  // Update animation state for all prepared elements
  getPreparedElements().forEach((elementData) => {
    updateElementAnimationState(elementData, currentScrollY);
  });
}

// ===================================================================
// ELEMENT PREPARATION AND POSITIONING
// ===================================================================

/**
 * Calculates the scroll positions that will trigger animations for an element
 * @param elementData - The element data to calculate positions for
 */
function calculateElementTriggerPositions(elementData: MosElement): void {
  const { element, options } = elementData;

  elementData.position = {
    // Calculate entry position (when element should animate in)
    in: getPositionIn(element, options),
    // Calculate exit position (when element should animate out) - only if mirror is enabled
    out: options.mirror && !options.once ? getPositionOut(element, options) : false,
  };
}

/**
 * Sets the initial animation state for an element based on its viewport position
 * @param elementData - The element data to set initial state for
 */
function setElementInitialState(elementData: MosElement): void {
  const { element, options } = elementData;

  if (isElementAboveViewport(element) && !options.mirror) {
    // Element is above viewport - set to final animated state immediately
    setFinalState(element, options);
    elementData.animated = true;
  } else {
    // Element is in or below viewport - set to initial state
    setInitialState(element, options);
    elementData.animated = false;
  }

  // Reset reversing state
  elementData.isReversing = false;
}

/**
 * Recalculates trigger positions for all elements after layout changes
 * Called on window resize and orientation change events
 */
function recalculateAllPositions(): void {
  // Use the unified element system's recalculation function
  // This will be called with the global options from the main module
  // For now, we'll update positions manually and then process scroll
  getPreparedElements().forEach((elementData) => {
    calculateElementTriggerPositions(elementData);
  });

  // Update animation states based on new positions
  processScrollEvent();
}

// ===================================================================
// CONFIGURATION MANAGEMENT
// ===================================================================

/**
 * Updates the throttle and debounce delays used by the scroll handler
 * Called from the main initialization to apply user configuration
 * @param throttleDelay - Delay in ms for throttling scroll events
 * @param debounceDelay - Delay in ms for debouncing resize events
 */
export function updateScrollHandlerDelays(throttleDelay: number, debounceDelay: number): void {
  currentThrottleDelay = throttleDelay;
  currentDebounceDelay = debounceDelay;
}

// ===================================================================
// ELEMENT OBSERVATION MANAGEMENT
// ===================================================================

/**
 * Adds an element to scroll-based animation tracking
 * If element is already being tracked, updates its options
 * @param element - The DOM element to observe
 * @param options - Animation configuration for this element
 */
export function observeElement(element: HTMLElement, options: ElementOptions): void {
  // Apply any custom delays from element options
  updateScrollHandlerDelays(
    options.throttleDelay ?? DEFAULT_OPTIONS.throttleDelay,
    options.debounceDelay ?? DEFAULT_OPTIONS.debounceDelay,
  );

  // Elements are now managed by the unified elements.ts system
  // This function just ensures the scroll handler is active
  ensureScrollHandlerActive();
}

// ===================================================================
// SCROLL HANDLER LIFECYCLE
// ===================================================================

/**
 * Initializes the scroll event handler system with throttling and debouncing
 * Sets up listeners for scroll, resize, and orientation change events
 */
function ensureScrollHandlerActive(): void {
  // Prevent multiple initializations
  if (activeScrollHandler) return;

  // Create throttled and debounced handlers for performance
  const throttledScrollHandler = throttle(processScrollEvent, currentThrottleDelay);
  const debouncedPositionRecalculator = debounce(recalculateAllPositions, currentDebounceDelay);

  // Set up event listeners
  setupScrollEventListeners(throttledScrollHandler, debouncedPositionRecalculator);

  // Store references for cleanup
  activeScrollHandler = throttledScrollHandler;
  activeResizeHandler = debouncedPositionRecalculator;
}

/**
 * Sets up all necessary event listeners for scroll handling
 * @param scrollHandler - Throttled scroll event handler
 * @param resizeHandler - Debounced resize event handler
 */
function setupScrollEventListeners(
  scrollHandler: (...args: any[]) => void,
  resizeHandler: (...args: any[]) => void,
): void {
  // Scroll events (throttled for performance)
  window.addEventListener("scroll", scrollHandler, { passive: true });

  // Layout change events (debounced to prevent excessive recalculation)
  window.addEventListener("resize", resizeHandler);
  window.addEventListener("orientationchange", resizeHandler);
}

/**
 * Cleans up the scroll handler system and removes all event listeners
 * Resets all tracking state to initial conditions
 */
export function cleanupScrollHandler(): void {
  if (activeScrollHandler) {
    // Remove all event listeners
    window.removeEventListener("scroll", activeScrollHandler);
    if (activeResizeHandler) {
      window.removeEventListener("resize", activeResizeHandler);
      window.removeEventListener("orientationchange", activeResizeHandler);
    }

    // Clear handler references
    activeScrollHandler = null;
    activeResizeHandler = null;
  }
}

// ===================================================================
// PUBLIC API
// ===================================================================

/**
 * Refreshes all tracked elements by recalculating positions and states
 * Called when the library needs to update after configuration changes
 */
export function refreshElements(): void {
  getPreparedElements().forEach((elementData) => {
    calculateElementTriggerPositions(elementData);
    setElementInitialState(elementData);
  });

  // Process current scroll position to animate elements already in viewport
  processScrollEvent();
  processScrollEvent();
}
