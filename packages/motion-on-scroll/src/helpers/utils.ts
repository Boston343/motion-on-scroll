/**
 * Helper utilities for MOS library.
 */

import type { DeviceDisable } from "./types.js";

/**
 * Evaluate whether MOS should be disabled for current environment.
 * Mirrors AOS `disable` option behaviour.
 */
/**
 * Determine if MOS should be disabled for the current viewport.
 */
export function isDisabled(disable: DeviceDisable): boolean {
  if (typeof disable === "boolean") return disable;
  if (typeof disable === "function") {
    try {
      return !!disable();
    } catch {
      return false;
    }
  }
  if (typeof window === "undefined") return false;
  const width = window.innerWidth;
  switch (disable) {
    case "phone":
      return width < 768;
    case "tablet":
      return width >= 768 && width < 1024;
    case "mobile":
      return width < 1024;
    default:
      return false;
  }
}

/**
 * Remove all `data-mos*` attributes from the given element, used when MOS is
 * globally disabled so that any CSS rules tied to these attributes stop
 * applying.
 */
export function removeMosAttributes(el: Element): void {
  for (const { name } of Array.from(el.attributes)) {
    if (name.startsWith("data-mos")) {
      el.removeAttribute(name);
    }
  }
}
