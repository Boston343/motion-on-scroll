// ===================================================================
// MOTION-ON-SCROLL (MOS) - Main Entry Point
// ===================================================================
// This file provides the public API for the Motion-on-Scroll library.
// It handles initialization, configuration, and lifecycle management.

import { registerAnimation } from "./helpers/animations.js";
import { DEFAULT_OPTIONS } from "./helpers/constants.js";
import { registerEasing } from "./helpers/easing.js";
import {
  clearAllElements,
  getMosElements,
  invalidateElementCache,
  isElementObserved,
  markElementObserved,
  prepareElements,
} from "./helpers/elements.js";
import { registerKeyframes } from "./helpers/keyframes.js";
import { startDomObserver } from "./helpers/observer.js";
import {
  cleanupScrollHandler,
  observeElement as startObservingElement,
  refreshElements,
  updateScrollHandlerDelays,
} from "./helpers/scroll-handler.js";
import type { ElementOptions, MosOptions, PartialMosOptions } from "./helpers/types.js";
import { debounce, isDisabled, removeMosAttributes } from "./helpers/utils.js";

// ===================================================================
// LIBRARY STATE MANAGEMENT
// ===================================================================

/**
 * Global configuration options merged from all init() calls
 */
let libraryConfig: MosOptions = DEFAULT_OPTIONS;

/**
 * Tracks whether the library has been initialized and is actively running
 */
let isLibraryActive = false;

// Element tracking is now handled by the unified elements.ts system
// observedElements tracking is also handled there

// ===================================================================
// ELEMENT DISCOVERY AND MANAGEMENT
// ===================================================================

/**
 * Finds all elements in the DOM that have the data-mos attribute
 * @returns Array of HTMLElements with data-mos attributes
 */
/**
 * Starts observing an element for scroll-based animations
 * Prevents duplicate observations using the observedElements set
 * @param element - The DOM element to observe
 * @param options - Animation options for this element
 */
export function observeElementOnce(element: HTMLElement, options: ElementOptions): void {
  // Skip if already observing this element
  if (isElementObserved(element)) return;

  // Skip if animations are disabled for this element
  if (isDisabled(options.disable)) return;

  // Mark as observed and start observing
  markElementObserved(element);
  startObservingElement(element, options);
}

// ===================================================================
// CONFIGURATION AND TIME UNITS
// ===================================================================

/**
 * Adjusts duration and delay values when using seconds instead of milliseconds
 * Only applied on first initialization when timeUnits is set to "s"
 * @param config - The configuration object to potentially modify
 */
function adjustTimeUnitsOnFirstInit(config: MosOptions): void {
  if (isLibraryActive || config.timeUnits !== "s") return;

  // Convert default duration from ms to seconds if not explicitly set
  if (config.duration == null) {
    config.duration = DEFAULT_OPTIONS.duration / 1000;
  }

  // Convert default delay from ms to seconds if not explicitly set
  if (config.delay == null) {
    config.delay = DEFAULT_OPTIONS.delay / 1000;
  }
}

/**
 * Recalculates element positions after layout changes
 * Called on window resize and orientation change
 */
export function handleLayoutChange(): void {
  if (isLibraryActive) {
    refreshElements();
  }
}

/**
 * Sets up event listeners for layout changes (resize, orientation)
 * Uses debounced handlers to prevent excessive recalculations
 */
function setupLayoutChangeListeners(): void {
  const debounceDelay = libraryConfig.debounceDelay ?? DEFAULT_OPTIONS.debounceDelay;
  const debouncedHandler = debounce(handleLayoutChange, debounceDelay);

  window.addEventListener("resize", debouncedHandler);
  window.addEventListener("orientationchange", debouncedHandler);
}

/**
 * Sets up the start event listener based on configuration
 * Handles both standard events (DOMContentLoaded, load) and custom events
 */
export function setupStartEventListener(): void {
  const startEvent = libraryConfig.startEvent ?? DEFAULT_OPTIONS.startEvent;

  // If the desired event has already fired, bootstrap immediately
  if (
    (startEvent === "DOMContentLoaded" &&
      ["interactive", "complete"].includes(document.readyState)) ||
    (startEvent === "load" && document.readyState === "complete")
  ) {
    refresh(true);
    return;
  }

  // Otherwise, attach listener for the start event
  if (startEvent === "load") {
    window.addEventListener(startEvent, () => refresh(true), { once: true });
  } else {
    document.addEventListener(startEvent, () => refresh(true), { once: true });
  }

  // Don't start mutation observer if disabled or not supported
  if (libraryConfig.disableMutationObserver || typeof MutationObserver === "undefined") {
    return;
  }
}

// ===================================================================
// PUBLIC API
// ===================================================================

/**
 * Initializes the Motion-on-Scroll library with the given options
 * Can be called multiple times - options will be merged
 * @param options - Configuration options for the library
 * @returns Array of elements found in the DOM (for compatibility)
 */
function init(options: PartialMosOptions = {}): HTMLElement[] {
  // Merge new options with existing configuration
  libraryConfig = { ...libraryConfig, ...options };

  // Handle time unit conversion on first initialization
  adjustTimeUnitsOnFirstInit(libraryConfig);

  // If already initialized, just refresh with new options
  if (isLibraryActive) {
    refresh();
    return getMosElements(); // Return current DOM elements
  }

  // First time init - find elements and check for global disable
  const foundElements = getMosElements();

  // Handle global disable - clean up and exit early
  if (isDisabled(libraryConfig.disable ?? false)) {
    foundElements.forEach(removeMosAttributes);
    return [];
  }

  // Set up event listeners
  setupStartEventListener();
  setupLayoutChangeListeners();
  startDomObserver();

  // Return current elements
  return foundElements;
}

/**
 * Refreshes the library by updating element positions and re-initializing scroll system
 * Does NOT re-find elements - only updates existing tracked elements
 * @param shouldActivate - Whether this refresh should activate the library (if not already active)
 */
function refresh(shouldActivate = false): void {
  if (shouldActivate) isLibraryActive = true;
  if (isLibraryActive) {
    // Configure performance settings from library config
    updateScrollHandlerDelays(
      libraryConfig.throttleDelay ?? DEFAULT_OPTIONS.throttleDelay,
      libraryConfig.debounceDelay ?? DEFAULT_OPTIONS.debounceDelay,
    );

    console.log("🔄 [MOS] Refreshing - recalculating positions and reprocessing elements");

    // Invalidate cache since DOM might have changed
    invalidateElementCache();

    // Find all MOS elements once and reuse them
    const foundElements = getMosElements();

    // Use unified element system to prepare elements (reusing found elements)
    const preparedElements = prepareElements(foundElements, libraryConfig);

    // Start observing each prepared element
    preparedElements.forEach((mosElement) => {
      observeElementOnce(mosElement.element, mosElement.options);
    });

    // Calculate positions and set initial states for all elements
    refreshElements();
  }
}

/**
 * Performs a hard refresh - re-finds all MOS elements and completely re-initializes
 * This is a full re-initialization that discovers new elements in the DOM
 */
function refreshHard(): void {
  // Re-find all MOS elements in case any were added or removed
  const foundElements = getMosElements();

  // Handle global disable - clean up and exit early
  if (isDisabled(libraryConfig.disable ?? false)) {
    foundElements.forEach(removeMosAttributes);
    return;
  }

  // Clear existing prepared elements and clean up scroll handlers
  clearAllElements();
  cleanupScrollHandler();

  // re-calculate positions and init scroll system
  refresh();
}

// ===================================================================
// EXPORTS
// ===================================================================

export const MOS = {
  init,
  refresh,
  refreshHard,
  registerKeyframes,
  registerEasing,
  registerAnimation,
};

export { init, refresh, refreshHard, registerAnimation, registerEasing, registerKeyframes };
