/**
 * Scroll direction tracking utility with throttling
 */

type ScrollDirection = "up" | "down" | "none";
type ScrollCallback = (direction: ScrollDirection) => void;

let lastScrollY = 0;
let currentDirection: ScrollDirection = "none";
const scrollCallbacks = new Set<ScrollCallback>();
let throttleTimer: number | null = null;
let isInitialized = false;

// const THROTTLE_MS = 16; // ~60fps
const THROTTLE_MS = 99; // match AOS

function handleScroll() {
  if (throttleTimer) return;

  throttleTimer = window.setTimeout(() => {
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
    throttleTimer = null;
  }, THROTTLE_MS);
}

/**
 * Initialize scroll tracking
 */
export function initScrollTracker(): void {
  if (isInitialized) return;

  lastScrollY = window.scrollY;
  window.addEventListener("scroll", handleScroll, { passive: true });
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
 * Check if element is above the current viewport
 */
export function isElementAboveViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom < 0;
}

/**
 * Cleanup scroll tracker
 */
export function cleanupScrollTracker(): void {
  if (!isInitialized) return;

  window.removeEventListener("scroll", handleScroll);
  scrollCallbacks.clear();
  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
  isInitialized = false;
}
