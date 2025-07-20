/**
 * Scroll direction tracking utility with throttling
 */

import { DEFAULT_OPTIONS } from "./constants.js";
import { throttle } from "./utils.js";

type ScrollDirection = "up" | "down" | "none";
type ScrollCallback = (direction: ScrollDirection) => void;

let lastScrollY = 0;
let currentDirection: ScrollDirection = "none";
const scrollCallbacks = new Set<ScrollCallback>();
let isInitialized = false;
let throttledScrollHandler: (() => void) | null = null;
let currentThrottleDelay = DEFAULT_OPTIONS.throttleDelay;

function handleScrollInternal() {
  const currentScrollY = window.scrollY;
  const previousDirection = currentDirection;

  if (currentScrollY > lastScrollY && currentScrollY > 0) {
    currentDirection = "down";
  } else if (currentScrollY < lastScrollY) {
    currentDirection = "up";
  } else {
    currentDirection = "none";
  }

  // Only notify if direction changed
  if (previousDirection !== currentDirection) {
    scrollCallbacks.forEach((callback) => callback(currentDirection));
  }

  lastScrollY = currentScrollY;
}

/**
 * Update throttle delay for scroll tracking
 */
export function updateScrollTrackerDelay(throttleDelay: number): void {
  currentThrottleDelay = throttleDelay;

  // If already initialized, recreate the throttled handler
  if (isInitialized && throttledScrollHandler) {
    window.removeEventListener("scroll", throttledScrollHandler);
    throttledScrollHandler = throttle(handleScrollInternal, currentThrottleDelay);
    window.addEventListener("scroll", throttledScrollHandler, { passive: true });
  }
}

/**
 * Initialize scroll tracking
 */
export function initScrollTracker(): void {
  if (isInitialized) return;

  lastScrollY = window.scrollY;
  throttledScrollHandler = throttle(handleScrollInternal, currentThrottleDelay);
  window.addEventListener("scroll", throttledScrollHandler, { passive: true });
  isInitialized = true;
}

/**
 * Get current scroll direction
 */
export function getScrollDirection(): ScrollDirection {
  return currentDirection;
}

/**
 * Subscribe to scroll direction changes
 */
export function onScrollDirectionChange(callback: ScrollCallback): () => void {
  scrollCallbacks.add(callback);

  // Return unsubscribe function
  return () => {
    scrollCallbacks.delete(callback);
  };
}

/**
 * Cleanup scroll tracker
 */
export function cleanupScrollTracker(): void {
  if (!isInitialized) return;

  if (throttledScrollHandler) {
    window.removeEventListener("scroll", throttledScrollHandler);
  }
  scrollCallbacks.clear();
  throttledScrollHandler = null;
  isInitialized = false;
}
