import { observeElement as observeElementWithScrollHandler } from "./scroll-handler.js";
import type { AnchorPlacement, ElementOptions, MarginType } from "./types.js";
import { isDisabled } from "./utils.js";

/**
 * Anchor-placement mapping borrowed from AOS. We approximate the 9-grid
 * intersections by tweaking only the `amount` parameter (0–1 fraction of the
 * element that must be inside the root).
 *
 * This keeps implementation lightweight – fine-tuning via asymmetric
 * `rootMargin` can still be applied later if real-world usage shows it’s
 * necessary.
 */
const AMOUNT_MAP: Record<AnchorPlacement, number> = {
  "top-top": 1, // element fully visible
  "top-center": 0.75,
  "top-bottom": 0,
  "center-top": 0.5,
  "center-center": 0.5,
  "center-bottom": 0.5,
  "bottom-top": 0,
  "bottom-center": 0.25,
  "bottom-bottom": 0, // element enters with first pixel
};

export function computeIOOptions(
  placement: AnchorPlacement | undefined,
  offset: number,
): { margin: MarginType; amount: number } {
  const margin = `${offset}px 0px -${offset}px 0px` as MarginType;
  const amount = placement ? (AMOUNT_MAP[placement] ?? 0) : 0;
  return { margin, amount };
}

/**
 * Observe an element using custom AOS-style scroll detection
 * This replaces Motion's inView with direct scroll event handling
 */
export function observeElement(el: HTMLElement, opts: ElementOptions) {
  if (isDisabled(opts.disable)) {
    return; // Skip observing entirely when disabled
  }

  // Use the custom scroll handler instead of Motion's inView
  observeElementWithScrollHandler(el, opts);
}
