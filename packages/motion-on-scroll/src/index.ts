import { registerAnimation } from "./helpers/animations.js";
import { resolveElementOptions } from "./helpers/attributes.js";
import { DEFAULT_OPTIONS } from "./helpers/constants.js";
import { registerEasing } from "./helpers/easing.js";
import { registerKeyframes } from "./helpers/keyframes.js";
import { observeElement } from "./helpers/observer.js";
import {
  cleanupScrollHandler,
  refreshElements,
  updateScrollHandlerDelays,
} from "./helpers/scroll-handler.js";
import { initScrollTracker, updateScrollTrackerDelay } from "./helpers/scroll-tracker.js";
import type { PartialMosOptions } from "./helpers/types.js";
import { debounce, isDisabled, removeMosAttributes } from "./helpers/utils.js";

// Track elements already observed to avoid duplicate observations
const _observedEls = new WeakSet<HTMLElement>();
function observeOnce(el: HTMLElement, opts: Parameters<typeof observeElement>[1]) {
  if (_observedEls.has(el)) return;
  _observedEls.add(el);
  observeElement(el, opts);
}

let globalOptions: PartialMosOptions = {};
// Indicates that the core observers have been started
let initialized = false;
let mo: MutationObserver | null = null;

function collectElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-mos]"));
}

/**
 * Initialize scroll handling (similar to AOS initializeScroll)
 */
function initializeScroll() {
  // Update scroll handler delays from global options
  updateScrollHandlerDelays(
    globalOptions.throttleDelay ?? DEFAULT_OPTIONS.throttleDelay,
    globalOptions.debounceDelay ?? DEFAULT_OPTIONS.debounceDelay,
  );

  // Update scroll tracker delay from global options
  updateScrollTrackerDelay(globalOptions.throttleDelay ?? DEFAULT_OPTIONS.throttleDelay);

  // Initialize scroll direction tracking
  initScrollTracker();

  // Observe current elements and prepare them
  collectElements().forEach((el) => {
    const opts = resolveElementOptions(el, globalOptions);
    observeOnce(el, opts);
  });

  // Refresh elements to calculate positions and set initial states
  refreshElements();

  return collectElements();
}

/**
 * Recalculate element positions (similar to AOS recalculatePositions)
 */
function recalculatePositions() {
  if (initialized) {
    // Refresh all elements to recalculate positions
    refreshElements();
  }
}

function bootstrap() {
  // If already initialised by auto-init, merge new options and refresh
  if (initialized) return;
  initialized = true;

  // Global disable shortcut – strip data attributes and abort
  if (isDisabled(globalOptions.disable ?? false)) {
    collectElements().forEach(removeMosAttributes);
    return;
  }

  // Start MutationObserver unless disabled
  if (!globalOptions.disableMutationObserver && typeof MutationObserver !== "undefined") {
    mo?.disconnect();
    mo = new MutationObserver(() => refreshHard());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Initialize scroll handling
  initializeScroll();
}

/**
 * Refresh MOS (similar to AOS refresh)
 */
function refresh(initialize = false) {
  // Allow refresh only when it was first initialized on startEvent
  if (initialize) initialized = true;
  if (initialized) initializeScroll();
}

function init(options: PartialMosOptions = {}) {
  // Merge new options onto existing ones (later options override earlier ones)
  globalOptions = { ...globalOptions, ...options };

  // Handle alternate time units adjustment the first time init is called
  if (!initialized && globalOptions.timeUnits === "s") {
    if (globalOptions.duration == null) globalOptions.duration = DEFAULT_OPTIONS.duration / 1000;
    if (globalOptions.delay == null) globalOptions.delay = DEFAULT_OPTIONS.delay / 1000;
  }

  const startEvent = globalOptions.startEvent ?? DEFAULT_OPTIONS.startEvent;

  // If MOS has already been initialised by a previous call, just refresh and return
  if (initialized) {
    collectElements().forEach((el) => {
      const opts = resolveElementOptions(el, globalOptions);
      observeOnce(el, opts);
    });
    return;
  }

  /**
   * Don't init plugin if option `disable` is set
   */
  if (isDisabled(globalOptions.disable ?? false)) {
    collectElements().forEach(removeMosAttributes);
    return;
  }

  /**
   * Handle initializing
   */
  if (["DOMContentLoaded", "load"].indexOf(startEvent) === -1) {
    // Listen to startEvent and initialize MOS
    document.addEventListener(startEvent, function () {
      refresh(true);
    });
  } else {
    // Use DOMContentLoaded as default
    window.addEventListener("DOMContentLoaded", function () {
      refresh(true);
    });
  }

  /**
   * Recalculate positions of elements on window resize or orientation change
   */
  window.addEventListener(
    "resize",
    debounce(recalculatePositions, globalOptions.debounceDelay ?? DEFAULT_OPTIONS.debounceDelay),
  );
  window.addEventListener(
    "orientationchange",
    debounce(recalculatePositions, globalOptions.debounceDelay ?? DEFAULT_OPTIONS.debounceDelay),
  );

  return collectElements();
}

/**
 * Hard refresh (similar to AOS refreshHard)
 * Create array with new elements and trigger refresh
 */
function refreshHard() {
  // Re-run observation for all current elements with existing global options
  if (isDisabled(globalOptions.disable ?? false)) {
    collectElements().forEach(removeMosAttributes);
    return;
  }

  // Clean up existing scroll handler
  cleanupScrollHandler();

  // Re-initialize with current elements
  refresh();
}

export const MOS = { init, refreshHard, registerKeyframes, registerEasing, registerAnimation };
export { init, refreshHard, registerAnimation, registerEasing, registerKeyframes };
