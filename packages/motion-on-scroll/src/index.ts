// ===================================================================
// MOTION-ON-SCROLL (MOS) - Main Entry Point
// ===================================================================
// This file provides the public API for the Motion-on-Scroll library.
// It handles initialization, configuration, and lifecycle management.

import { cancelPendingShow, registerAnimation } from "./helpers/animations.js";
import { DEFAULT_OPTIONS } from "./helpers/constants.js";
import { registerEasing } from "./helpers/easing.js";
import {
  clearAllElements,
  getMosElements,
  getPreparedElements,
  prepareElements,
} from "./helpers/elements.js";
import { registerKeyframes } from "./helpers/keyframes.js";
import { startDomObserver, stopDomObserver } from "./helpers/observer.js";
import {
  cleanupScrollHandler,
  ensureScrollHandlerActive,
  evaluateElementPositions,
  updateScrollHandlerDelays,
} from "./helpers/scroll-handler.js";
import type { MosOptions, PartialMosOptions } from "./helpers/types.js";
import {
  debounce,
  isDisabled,
  prefersReducedMotion,
  removeMosAttributes,
} from "./helpers/utils.js";

// ===================================================================
// LIBRARY STATE MANAGEMENT
// ===================================================================

/**
 * Options passed by the user, accumulated across all init() calls (like AOS)
 */
let userOptions: PartialMosOptions = {};

/**
 * Global configuration: defaults merged with the accumulated user options
 */
let libraryConfig: MosOptions = { ...DEFAULT_OPTIONS };

/**
 * Tracks whether the library has been initialized and is actively running
 */
let isLibraryActive = false;

/**
 * Removes the listeners registered by init() (null until init() has set them up)
 */
let removeListeners: (() => void) | null = null;

// ===================================================================
// CONFIGURATION AND TIME UNITS
// ===================================================================

/**
 * Builds the library configuration from the defaults and everything the user has passed so far
 * When timeUnits is "s", default duration and delay are converted from ms unless explicitly set
 */
function resolveConfig(options: PartialMosOptions): MosOptions {
  const config: MosOptions = { ...DEFAULT_OPTIONS, ...options };

  if (config.timeUnits === "s") {
    if (options.duration == null) config.duration = DEFAULT_OPTIONS.duration / 1000;
    if (options.delay == null) config.delay = DEFAULT_OPTIONS.delay / 1000;
  }

  return config;
}

/**
 * Whether MOS should stay out of the way entirely: either through the `disable`
 * option, or because the user prefers reduced motion
 */
function shouldDisable(): boolean {
  return (
    isDisabled(libraryConfig.disable) ||
    (libraryConfig.respectReducedMotion && prefersReducedMotion())
  );
}

/**
 * Stops everything MOS has running: listeners, the DOM observer, the scroll handler
 * and element tracking. Animations are let go of without resetting what is on screen.
 */
function teardown(): void {
  removeListeners?.();
  removeListeners = null;

  stopDomObserver();
  cleanupScrollHandler();

  getPreparedElements().forEach((mosElement) => {
    cancelPendingShow(mosElement);
    mosElement.controls = undefined;
  });
  clearAllElements();

  isLibraryActive = false;
}

/**
 * Turns MOS off for the given elements so they render as plain content:
 * anything still waiting to animate in is jumped to its final state, tracking
 * stops, and the MOS attributes and classes are stripped.
 */
function disableElements(elements: HTMLElement[]): void {
  getPreparedElements().forEach((mosElement) => {
    cancelPendingShow(mosElement);
    if (!mosElement.controls) return;

    // Forward speed first: completing a reversed animation would end on the hidden state
    mosElement.controls.speed = 1;
    mosElement.controls.complete();
  });
  teardown();

  const { initClassName, animatedClassName } = libraryConfig;
  elements.forEach((element) => {
    removeMosAttributes(element);
    if (initClassName) element.classList.remove(initClassName);
    if (animatedClassName) element.classList.remove(animatedClassName);
  });
}

/**
 * Recalculates element positions after layout changes
 * Called on window resize and orientation change
 */
export function handleLayoutChange(): void {
  if (isLibraryActive) {
    evaluateElementPositions();
  }
}

/**
 * Sets up the start event listener based on configuration
 * Handles both standard events (DOMContentLoaded, load) and custom events
 * @returns Function that removes the listener again (if one was added)
 */
export function setupStartEventListener(): () => void {
  const startEvent = libraryConfig.startEvent;
  const start = (): void => refresh(true);

  // If the desired event has already fired, bootstrap immediately
  if (
    (startEvent === "DOMContentLoaded" &&
      ["interactive", "complete"].includes(document.readyState)) ||
    (startEvent === "load" && document.readyState === "complete")
  ) {
    start();
    return () => {};
  }

  // Otherwise, attach listener for the start event
  const target = startEvent === "load" ? window : document;
  target.addEventListener(startEvent, start, { once: true });
  return () => target.removeEventListener(startEvent, start);
}

/**
 * Recalculates positions once the page has fully loaded (like AOS does)
 * Images and fonts that arrive after DOMContentLoaded move elements around,
 * which would leave the trigger positions calculated at start stale
 * @returns Function that removes the listener again (if one was added)
 */
function setupLoadRefreshListener(): () => void {
  if (libraryConfig.startEvent === "load" || document.readyState === "complete") {
    return () => {};
  }

  const onLoad = (): void => refresh();
  window.addEventListener("load", onLoad, { once: true });
  return () => window.removeEventListener("load", onLoad);
}

/**
 * Sets up all event listeners: the start event plus layout changes (resize, orientation)
 * Uses debounced handlers to prevent excessive recalculations
 * @returns Function that removes every listener again
 */
function setupListeners(): () => void {
  const debouncedHandler = debounce(handleLayoutChange, libraryConfig.debounceDelay);

  window.addEventListener("resize", debouncedHandler);
  window.addEventListener("orientationchange", debouncedHandler);
  const removeStartListener = setupStartEventListener();
  const removeLoadListener = setupLoadRefreshListener();

  return () => {
    window.removeEventListener("resize", debouncedHandler);
    window.removeEventListener("orientationchange", debouncedHandler);
    removeStartListener();
    removeLoadListener();
  };
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
  // Merge new options with everything passed to earlier init() calls
  userOptions = { ...userOptions, ...options };
  libraryConfig = resolveConfig(userOptions);

  // Handle global disable (checked on every call, like AOS) - clean up and exit early
  if (shouldDisable()) {
    disableElements(getMosElements(true));
    return [];
  }

  // If already initialized, just refresh with new options
  if (isLibraryActive) {
    refresh();
    return getMosElements(); // Return current DOM elements
  }

  // Find elements
  const foundElements = getMosElements();

  // Set up event listeners (replacing any from an earlier init() that hasn't started yet)
  removeListeners?.();
  removeListeners = setupListeners();

  // Don't start mutation observer if disabled or not supported
  if (!libraryConfig.disableMutationObserver && typeof MutationObserver !== "undefined") {
    startDomObserver();
  }

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
    prepareAndEvaluate(getMosElements());
  }
}

/**
 * Prepares the given elements (keeping the state of those already tracked),
 * then calculates positions and applies the state for the current scroll position
 */
function prepareAndEvaluate(elements: HTMLElement[]): void {
  // Configure performance settings from library config
  updateScrollHandlerDelays(libraryConfig.throttleDelay);

  // Use unified element system to prepare elements
  prepareElements(elements, libraryConfig);

  // Ensure scroll handler is active to process all prepared elements
  ensureScrollHandlerActive();

  // Calculate positions and set initial states for all elements
  evaluateElementPositions();
}

/**
 * Performs a hard refresh - re-finds all MOS elements in the DOM
 * Newly added elements start being tracked and removed elements are cleaned up,
 * while elements that were already tracked keep their animated state
 */
function refreshHard(): void {
  // Re-find all MOS elements in case any were added or removed
  const foundElements = getMosElements(true);

  // Handle global disable - clean up and exit early
  if (shouldDisable()) {
    disableElements(foundElements);
    return;
  }

  if (isLibraryActive) {
    prepareAndEvaluate(foundElements);
  }
}

/**
 * Shuts MOS down: removes every listener and observer and stops tracking all elements
 * Elements keep the visual state they are in. Options passed to earlier init() calls
 * are forgotten, so a later init() starts from scratch.
 */
function destroy(): void {
  teardown();

  userOptions = {};
  libraryConfig = { ...DEFAULT_OPTIONS };
}

// ===================================================================
// EXPORTS
// ===================================================================

export const MOS = {
  init,
  refresh,
  refreshHard,
  destroy,
  registerKeyframes,
  registerEasing,
  registerAnimation,
};

export {
  destroy,
  init,
  refresh,
  refreshHard,
  registerAnimation,
  registerEasing,
  registerKeyframes,
};

export type { AnimationFactory } from "./helpers/animations.js";
export type { EasingDefinition } from "./helpers/easing.js";
export type {
  AnchorPlacement,
  DeviceDisable,
  ElementOptions,
  MosOptions,
  PartialMosOptions,
} from "./helpers/types.js";

export default MOS;
