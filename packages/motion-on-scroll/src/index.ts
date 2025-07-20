// ===================================================================
// MOTION-ON-SCROLL (MOS) - Main Entry Point
// ===================================================================
// This file provides the public API for the Motion-on-Scroll library.
// It handles initialization, configuration, and lifecycle management.

import { registerAnimation } from "./helpers/animations.js";
import { resolveElementOptions } from "./helpers/attributes.js";
import { DEFAULT_OPTIONS } from "./helpers/constants.js";
import { registerEasing } from "./helpers/easing.js";
import { registerKeyframes } from "./helpers/keyframes.js";
import {
  cleanupScrollHandler,
  observeElement as startObservingElement,
  refreshElements,
  updateScrollHandlerDelays,
} from "./helpers/scroll-handler.js";
import { initScrollTracker, updateScrollTrackerDelay } from "./helpers/scroll-tracker.js";
import type { ElementOptions, PartialMosOptions } from "./helpers/types.js";
import { debounce, isDisabled, removeMosAttributes } from "./helpers/utils.js";

// ===================================================================
// LIBRARY STATE MANAGEMENT
// ===================================================================

/**
 * Global configuration options merged from all init() calls
 */
let libraryConfig: PartialMosOptions = {};

/**
 * Tracks whether the library has been initialized and is actively running
 */
let isLibraryActive = false;

/**
 * DOM mutation observer for detecting new elements added to the page
 */
let domObserver: MutationObserver | null = null;

/**
 * Set of elements already being observed to prevent duplicate observations
 */
const observedElements = new WeakSet<HTMLElement>();

// ===================================================================
// ELEMENT DISCOVERY AND MANAGEMENT
// ===================================================================

/**
 * Finds all elements in the DOM that have the data-mos attribute
 * @returns Array of HTMLElements with data-mos attributes
 */
function findMosElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-mos]"));
}

/**
 * Starts observing an element for scroll-based animations
 * Prevents duplicate observations using the observedElements set
 * @param element - The DOM element to observe
 * @param options - Animation options for this element
 */
function observeElementOnce(element: HTMLElement, options: ElementOptions): void {
  // Skip if already observing this element
  if (observedElements.has(element)) return;

  // Skip if animations are disabled for this element
  if (isDisabled(options.disable)) return;

  // Mark as observed and start observing
  observedElements.add(element);
  startObservingElement(element, options);
}

/**
 * Processes all current MOS elements in the DOM
 * Resolves their options and starts observing them
 */
function processAllElements(): HTMLElement[] {
  const elements = findMosElements();

  elements.forEach((element) => {
    const elementOptions = resolveElementOptions(element, libraryConfig);
    observeElementOnce(element, elementOptions);
  });

  return elements;
}

// ===================================================================
// SCROLL SYSTEM INITIALIZATION
// ===================================================================

/**
 * Configures and starts the scroll detection system
 * This includes throttling, scroll tracking, and element preparation
 */
function initializeScrollSystem(): void {
  // Configure performance settings from library config
  updateScrollHandlerDelays(
    libraryConfig.throttleDelay ?? DEFAULT_OPTIONS.throttleDelay,
    libraryConfig.debounceDelay ?? DEFAULT_OPTIONS.debounceDelay,
  );
  updateScrollTrackerDelay(libraryConfig.throttleDelay ?? DEFAULT_OPTIONS.throttleDelay);

  // Start scroll direction tracking
  initScrollTracker();

  // Process all elements and start observing them
  processAllElements();

  // Calculate positions and set initial states for all elements
  refreshElements();
}

/**
 * Recalculates element positions after layout changes
 * Called on window resize and orientation change
 */
function handleLayoutChange(): void {
  if (isLibraryActive) {
    refreshElements();
  }
}

// ===================================================================
// DOM MUTATION HANDLING
// ===================================================================

/**
 * Starts observing DOM changes to detect new MOS elements
 * Only runs if mutation observer is not disabled in config
 */
function startDomObserver(): void {
  if (libraryConfig.disableMutationObserver || typeof MutationObserver === "undefined") {
    return;
  }

  // Clean up existing observer
  domObserver?.disconnect();

  // Create new observer that triggers a hard refresh when DOM changes
  domObserver = new MutationObserver(() => performHardRefresh());
  domObserver.observe(document.body, { childList: true, subtree: true });
}

// ===================================================================
// LIBRARY LIFECYCLE MANAGEMENT
// ===================================================================

/**
 * Starts the library systems (scroll detection, DOM observation, etc.)
 * Only runs once - subsequent calls are ignored
 */
function startLibrarySystems(): void {
  // Prevent multiple initializations
  if (isLibraryActive) return;
  isLibraryActive = true;

  // Handle global disable - clean up and exit early
  if (isDisabled(libraryConfig.disable ?? false)) {
    findMosElements().forEach(removeMosAttributes);
    return;
  }

  // Start DOM mutation observer
  startDomObserver();

  // Initialize scroll detection system
  initializeScrollSystem();
}

/**
 * Refreshes the library state and re-processes elements
 * @param shouldActivate - Whether this refresh should activate the library
 */
function refreshLibrary(shouldActivate = false): void {
  if (shouldActivate) isLibraryActive = true;
  if (isLibraryActive) initializeScrollSystem();
}

/**
 * Performs a complete reset and refresh of the library
 * Cleans up existing state and re-initializes everything
 */
function performHardRefresh(): void {
  // Handle global disable - clean up and exit early
  if (isDisabled(libraryConfig.disable ?? false)) {
    findMosElements().forEach(removeMosAttributes);
    return;
  }

  // Clean up existing scroll handlers
  cleanupScrollHandler();

  // Re-initialize everything
  refreshLibrary();
}

// ===================================================================
// CONFIGURATION AND TIME UNITS
// ===================================================================

/**
 * Adjusts duration and delay values when using seconds instead of milliseconds
 * Only applied on first initialization when timeUnits is set to "s"
 * @param config - The configuration object to potentially modify
 */
function adjustTimeUnitsOnFirstInit(config: PartialMosOptions): void {
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
function setupStartEventListener(): void {
  const startEvent = libraryConfig.startEvent ?? DEFAULT_OPTIONS.startEvent;

  if (["DOMContentLoaded", "load"].includes(startEvent)) {
    // Use DOMContentLoaded for standard events
    window.addEventListener("DOMContentLoaded", () => refreshLibrary(true));
  } else {
    // Listen for custom start event
    document.addEventListener(startEvent, () => refreshLibrary(true));
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
    return processAllElements();
  }

  // Handle global disable - clean up and exit early
  if (isDisabled(libraryConfig.disable ?? false)) {
    findMosElements().forEach(removeMosAttributes);
    return [];
  }

  // Set up event listeners
  setupStartEventListener();
  setupLayoutChangeListeners();

  // Return current elements for compatibility
  return findMosElements();
}

/**
 * Refreshes the library state and re-processes all elements
 * @param shouldActivate - Whether this refresh should activate the library
 */
function refresh(shouldActivate = false): void {
  refreshLibrary(shouldActivate);
}

/**
 * Performs a hard refresh - completely resets and re-initializes the library
 * Useful when the DOM structure has changed significantly
 */
function refreshHard(): void {
  performHardRefresh();
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
