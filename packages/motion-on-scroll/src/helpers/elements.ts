// ===================================================================
// UNIFIED ELEMENT MANAGEMENT
// ===================================================================
// This module provides a single source of truth for all MOS elements,
// based on the AOS prepare() pattern.

import { cancelPendingShow } from "./animations.js";
import { resolveElementOptions } from "./attributes.js";
import { getPositionIn, getPositionOut } from "./position-calculator.js";
import type { ElementOptions, MosElement, MosOptions } from "./types.js";

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
 * Options that define the animation itself. If any of these change between
 * refreshes the existing animation controls can no longer be reused.
 */
const ANIMATION_OPTION_KEYS = [
  "keyframes",
  "duration",
  "delay",
  "distance",
  "easing",
  "timeUnits",
] as const satisfies readonly (keyof ElementOptions)[];

function hasAnimationChanged(previous: ElementOptions, next: ElementOptions): boolean {
  return ANIMATION_OPTION_KEYS.some((key) => previous[key] !== next[key]);
}

/**
 * Cancels the animation controls of an element (if any) and forgets them
 */
export function disposeControls(mosElement: MosElement): void {
  cancelPendingShow(mosElement);
  try {
    mosElement.controls?.cancel();
  } catch {
    // the element may already be detached - nothing left to clean up
  }
  mosElement.controls = undefined;
}

/**
 * Prepares all MOS elements for animation tracking (AOS-style prepare function)
 * Resolves options and calculates positions for every element.
 *
 * Elements that are already tracked keep their state (like AOS, which reuses its
 * element objects on refresh), so already-animated elements are not reset.
 * Elements that are no longer in the list have their animations cleaned up.
 */
export function prepareElements(elements: HTMLElement[], options: MosOptions): MosElement[] {
  const previous = new Map(mosElements.map((mosEl) => [mosEl.element, mosEl]));

  mosElements = [];

  elements.forEach((element) => {
    const mosElement = prepareElement(element, options);
    if (!mosElement) return;

    const existing = previous.get(element);
    if (existing) {
      previous.delete(element);

      // Carry state over; only keep the animation if it is still the same animation
      mosElement.animated = existing.animated;
      if (hasAnimationChanged(existing.options, mosElement.options)) {
        disposeControls(existing);
      } else {
        mosElement.controls = existing.controls;
      }
    }

    if (mosElement.options.initClassName) {
      element.classList.add(mosElement.options.initClassName);
    }

    mosElements.push(mosElement);
  });

  // Anything left is no longer tracked (removed from the DOM or lost its data-mos attribute)
  previous.forEach(disposeControls);

  return mosElements;
}

/**
 * Prepares a single element for MOS tracking
 * Calculates positions, resolves options, and creates MosElement object
 */
export function prepareElement(element: HTMLElement, options: MosOptions): MosElement | null {
  // An empty data-mos attribute is still a MOS element (it uses the default "fade")
  if (!element.hasAttribute("data-mos")) return null;

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
 * Clears all prepared elements without touching their animations
 */
export function clearAllElements(): void {
  mosElements = [];
}

export default {
  clearAllElements,
  disposeControls,
  findPreparedElement,
  getMosElements,
  getPreparedElements,
  prepareElement,
  prepareElements,
  updatePreparedElements,
};
