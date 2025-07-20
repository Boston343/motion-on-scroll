import { observeElement as observeElementWithScrollHandler } from "./scroll-handler.js";
import type { ElementOptions } from "./types.js";
import { isDisabled } from "./utils.js";

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
