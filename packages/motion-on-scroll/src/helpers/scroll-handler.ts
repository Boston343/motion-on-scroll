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
 * Current throttle delay for scroll events (configurable)
 */
let currentThrottleDelay = DEFAULT_OPTIONS.throttleDelay;

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

    // Start reverse animation
    reverse(elementData);
  };

  /**
   * Shows the element by playing its animation
   * Only triggers if element is not already animated or is currently reversing
   */
  const showElement = (): void => {
    if (elementData.animated && !elementData.isReversing) return;

    // Start forward animation
    play(elementData);
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
    setFinalState(elementData);
  } else {
    // Element is in or below viewport - set to initial state
    setInitialState(elementData);
  }
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
 * Updates the throttle delay used by the scroll handler
 * Called from the main initialization to apply user configuration
 * @param throttleDelay - Delay in ms for throttling scroll events
 */
export function updateScrollHandlerDelays(throttleDelay: number): void {
  currentThrottleDelay = throttleDelay;
}

// ===================================================================
// SCROLL HANDLER LIFECYCLE
// ===================================================================

/**
 * Initializes the scroll event handler system with throttling
 * Sets up listener for scroll events only (layout changes handled in index.ts)
 */
export function ensureScrollHandlerActive(): void {
  // Prevent multiple initializations
  if (activeScrollHandler) return;

  // Create throttled scroll handler for performance
  const throttledScrollHandler = throttle(processScrollEvent, currentThrottleDelay);

  // Set up scroll event listener
  window.addEventListener("scroll", throttledScrollHandler, { passive: true });

  // Store reference for cleanup
  activeScrollHandler = throttledScrollHandler;
}

/**
 * Cleans up the scroll handler system and removes all event listeners
 * Resets all tracking state to initial conditions
 */
export function cleanupScrollHandler(): void {
  if (activeScrollHandler) {
    // Remove scroll event listener
    window.removeEventListener("scroll", activeScrollHandler);

    // Clear handler reference
    activeScrollHandler = null;
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
}
