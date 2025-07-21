// ===================================================================
// UNIFIED ELEMENT MANAGEMENT
// ===================================================================
// This module provides a single source of truth for all MOS elements,
// replacing the fragmented tracking across index.ts, scroll-handler.ts,
// and animations.ts. Based on the AOS prepare() pattern.

import type { AnimationPlaybackControls } from "motion";

import { resolveElementOptions } from "./attributes.js";
import { getPositionIn, getPositionOut, isElementAboveViewport } from "./position-calculator.js";
import type { ElementOptions, MosElement, MosOptions } from "./types.js";

// ===================================================================
// UNIFIED ELEMENT STORAGE
// ===================================================================

/**
 * Single source of truth for all elements being tracked by MOS
 * Replaces: MosElements[], trackedElements[], elementAnimationStates WeakMap
 */
let preparedElements: MosElement[] = [];

/**
 * Set of elements already being observed to prevent duplicate observations
 */
const observedElements = new WeakSet<HTMLElement>();

// ===================================================================
// ELEMENT PREPARATION (AOS-STYLE)
// ===================================================================

/**
 * Prepares all MOS elements for animation tracking (AOS-style prepare function)
 * Finds elements, calculates positions, sets initial states, and stores everything
 * in a unified array that replaces all previous fragmented storage
 */
export function prepareElements(options: MosOptions): MosElement[] {
  // Find all elements with data-mos attribute
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-mos]"));

  // Clear previous prepared elements
  preparedElements = [];

  // Prepare each element
  elements.forEach((element) => {
    const mosElement = prepareElement(element, options);
    if (mosElement) {
      preparedElements.push(mosElement);
    }
  });

  return preparedElements;
}

/**
 * Prepares a single element for MOS tracking
 * Calculates positions, resolves options, and creates MosElement object
 */
function prepareElement(element: HTMLElement, globalOptions: MosOptions): MosElement | null {
  const animationName = element.getAttribute("data-mos");
  if (!animationName) return null;

  // Resolve element-specific options using existing attributes system
  const elementOptions = resolveElementOptions(element, globalOptions);

  // Calculate scroll trigger positions
  const position = {
    in: getPositionIn(element, elementOptions),
    out:
      elementOptions.mirror && !elementOptions.once
        ? getPositionOut(element, elementOptions)
        : (false as const),
  };

  // Create unified MOS element object
  const mosElement: MosElement & { controls?: AnimationPlaybackControls } = {
    element,
    options: elementOptions,
    position,
    animated: false,
    isReversing: false,
    // Animation controls will be added when first created
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
  return preparedElements;
}

/**
 * Finds a prepared element by its DOM element
 */
export function findPreparedElement(
  element: HTMLElement,
): (MosElement & { controls?: AnimationPlaybackControls }) | undefined {
  return preparedElements.find((mosEl) => mosEl.element === element) as
    | (MosElement & { controls?: AnimationPlaybackControls })
    | undefined;
}

/**
 * Updates the prepared elements array (for position recalculation)
 */
export function updatePreparedElements(elements: MosElement[]): void {
  preparedElements = elements;
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
  preparedElements = [];
  // Note: WeakSet doesn't have a clear method, but elements will be garbage collected
}

/**
 * Recalculates positions for all prepared elements
 * Used when window is resized or orientation changes
 */
export function recalculateElementPositions(): void {
  preparedElements.forEach((mosElement) => {
    mosElement.position = {
      in: getPositionIn(mosElement.element, mosElement.options),
      out:
        mosElement.options.mirror && !mosElement.options.once
          ? getPositionOut(mosElement.element, mosElement.options)
          : false,
    };
  });
}
