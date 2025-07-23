// ===================================================================
// UNIFIED ELEMENT MANAGEMENT
// ===================================================================
// This module provides a single source of truth for all MOS elements,
// based on the AOS prepare() pattern.

import { resolveElementOptions } from "./attributes.js";
import { getPositionIn, getPositionOut } from "./position-calculator.js";
import type { MosElement, MosOptions } from "./types.js";

// ===================================================================
// UNIFIED ELEMENT STORAGE (SINGLE SOURCE OF TRUTH)
// ===================================================================

/**
 * Single source of truth for all elements being tracked by MOS
 * Contains both raw elements and their prepared data (positions, options, state)
 */
let mosElements: MosElement[] = [];

// ===================================================================
// DOM ELEMENT DISCOVERY
// ===================================================================

/**
 * Gets all raw DOM elements, using prepared elements as cache when available
 * If elements haven't been prepared yet or need refresh, queries DOM directly
 */
export function getMosElements(findNewElements: boolean = false): HTMLElement[] {
  // If we have prepared elements and don't need refresh, extract from them
  if (!findNewElements && mosElements.length > 0) {
    return mosElements.map((mosEl) => mosEl.element);
  }

  // Otherwise, query DOM directly
  return Array.from(document.querySelectorAll<HTMLElement>("[data-mos]"));
}

// ===================================================================
// ELEMENT PREPARATION (AOS-STYLE)
// ===================================================================

/**
 * Prepares all MOS elements for animation tracking (AOS-style prepare function)
 * Finds elements, calculates positions, sets initial states, and stores everything
 * in a unified array
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
export function prepareElement(element: HTMLElement, options: MosOptions): MosElement | null {
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
 * Clears all prepared elements
 */
export function clearAllElements(): void {
  mosElements = [];
}
