/**
 * Position calculation utilities based on AOS approach
 * Calculates element trigger positions based on natural document position
 */

import type { AnchorPlacement, ElementOptions } from "./types.js";

/**
 * Get element's natural offset position (ignoring transforms)
 * Based on AOS offset calculation
 */
export function getElementOffset(el: HTMLElement): { top: number; left: number } {
  let x = 0;
  let y = 0;
  let element = el;

  while (element && !isNaN(element.offsetLeft) && !isNaN(element.offsetTop)) {
    x += element.offsetLeft - (element.tagName !== "BODY" ? element.scrollLeft : 0);
    y += element.offsetTop - (element.tagName !== "BODY" ? element.scrollTop : 0);
    element = element.offsetParent as HTMLElement;
  }

  return {
    top: y,
    left: x,
  };
}

/**
 * Calculate trigger position for element entering viewport
 */
export function getPositionIn(el: HTMLElement, opts: ElementOptions): number {
  const windowHeight = window.innerHeight;
  const triggerEl = opts.anchor ? (document.querySelector<HTMLElement>(opts.anchor) ?? el) : el;

  let triggerPoint = getElementOffset(triggerEl).top - windowHeight;

  // Handle anchor placement (9-grid system)
  switch (opts.anchorPlacement) {
    case "top-bottom":
      // Default - no adjustment needed
      break;
    case "center-bottom":
      triggerPoint += triggerEl.offsetHeight / 2;
      break;
    case "bottom-bottom":
      triggerPoint += triggerEl.offsetHeight;
      break;
    case "top-center":
      triggerPoint += windowHeight / 2;
      break;
    case "center-center":
      triggerPoint += windowHeight / 2 + triggerEl.offsetHeight / 2;
      break;
    case "bottom-center":
      triggerPoint += windowHeight / 2 + triggerEl.offsetHeight;
      break;
    case "top-top":
      triggerPoint += windowHeight;
      break;
    case "bottom-top":
      triggerPoint += windowHeight + triggerEl.offsetHeight;
      break;
    case "center-top":
      triggerPoint += windowHeight + triggerEl.offsetHeight / 2;
      break;
  }

  return triggerPoint + opts.offset;
}

/**
 * Calculate trigger position for element exiting viewport (for scroll up behavior)
 */
export function getPositionOut(el: HTMLElement, opts: ElementOptions): number {
  const triggerEl = opts.anchor ? (document.querySelector<HTMLElement>(opts.anchor) ?? el) : el;
  const elementOffsetTop = getElementOffset(triggerEl).top;

  return elementOffsetTop + triggerEl.offsetHeight - opts.offset;
}

/**
 * Check if element is above current viewport (for initial state setting)
 */
export function isElementAboveViewport(el: HTMLElement): boolean {
  const elementOffset = getElementOffset(el);
  const elementBottom = elementOffset.top + el.offsetHeight;
  return elementBottom < window.scrollY;
}
