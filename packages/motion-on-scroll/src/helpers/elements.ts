// ===================================================================
// UNIFIED ELEMENT MANAGEMENT
// ===================================================================
// This module provides a single source of truth for all MOS elements,
// replacing the fragmented tracking across index.ts, scroll-handler.ts,
// and animations.ts. Based on the AOS prepare() pattern.

import { resolveElementOptions } from "./attributes.js";
import { getPositionIn, getPositionOut } from "./position-calculator.js";
import type { MosElement, MosOptions } from "./types.js";

// ===================================================================
// UNIFIED ELEMENT STORAGE
// ===================================================================

/**
 * Single source of truth for all elements being tracked by MOS
 */
let mosElements: MosElement[] = [];

/**
 * Set of elements already being observed to prevent duplicate observations
 */
const observedElements = new WeakSet<HTMLElement>();

/**
 * Cached DOM elements to avoid repeated queries
 */
let cachedDomElements: HTMLElement[] | null = null;

// ===================================================================
// DOM ELEMENT DISCOVERY
// ===================================================================

/**
 * Finds all elements with [data-mos] attribute in the DOM
 * Results are cached to avoid repeated queries until invalidated
 */
export function getMosElements(): HTMLElement[] {
  if (cachedDomElements === null) {
    cachedDomElements = Array.from(document.querySelectorAll<HTMLElement>("[data-mos]"));
  }
  return cachedDomElements;
}

/**
 * Invalidates the cached DOM elements, forcing a fresh query on next getMosElements call
 * Should be called when DOM structure changes (e.g., after dynamic content updates)
 */
export function invalidateElementCache(): void {
  cachedDomElements = null;
}

// ===================================================================
// ELEMENT PREPARATION (AOS-STYLE)
// ===================================================================

/**
 * Prepares all MOS elements for animation tracking (AOS-style prepare function)
 * Finds elements, calculates positions, sets initial states, and stores everything
 * in a unified array that replaces all previous fragmented storage
 */
export function prepareElements(elements: HTMLElement[], options: MosOptions): MosElement[] {
  // Clear previous prepared elements
  mosElements = [];

  // Prepare each element
  elements.forEach((element) => {
    const mosElement = prepareElement(element, options);
    if (mosElement) {
      mosElements.push(mosElement);
    }
  });

  return mosElements;
}

/**
 * Prepares a single element for MOS tracking
 * Calculates positions, resolves options, and creates MosElement object
 */
function prepareElement(element: HTMLElement, options: MosOptions): MosElement | null {
  const animationName = element.getAttribute("data-mos");
  if (!animationName) return null;

  // Resolve element-specific options using existing attributes system
  const elementOptions = resolveElementOptions(element, options);

  // Calculate scroll trigger positions
  const position = {
    in: getPositionIn(element, elementOptions),
    out:
      elementOptions.mirror && !elementOptions.once
        ? getPositionOut(element, elementOptions)
        : (false as const),
  };

  // Create unified MOS element object
  const mosElement: MosElement = {
    element,
    options: elementOptions,
    position,
    animated: false,
    isReversing: false,
    controls: undefined,
  };

  return mosElement;
}

// ===================================================================
// ELEMENT ACCESS AND MANAGEMENT
// ===================================================================

/**
 * Gets all prepared elements
 */
export function getPreparedElements(): MosElement[] {
  return mosElements;
}

/**
 * Finds a prepared element by its DOM element
 */
export function findPreparedElement(element: HTMLElement): MosElement | undefined {
  return mosElements.find((mosEl) => mosEl.element === element);
}

/**
 * Updates the prepared elements array (for position recalculation)
 */
export function updatePreparedElements(elements: MosElement[]): void {
  mosElements = elements;
}

/**
 * Checks if an element is already being observed
 */
export function isElementObserved(element: HTMLElement): boolean {
  return observedElements.has(element);
}

/**
 * Marks an element as observed
 */
export function markElementObserved(element: HTMLElement): void {
  observedElements.add(element);
}

/**
 * Clears all prepared elements and observation tracking
 */
export function clearAllElements(): void {
  mosElements = [];
  // Note: WeakSet doesn't have a clear method, but elements will be garbage collected
}
