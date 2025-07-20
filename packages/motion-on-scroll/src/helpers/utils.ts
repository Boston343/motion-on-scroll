/**
 * Helper utilities for MOS library.
 */

import type { DeviceDisable } from "./types.js";

/**
 * Simple throttle function (no external dependencies)
 * Ensures function is called at most once per delay period
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  let lastExecTime = 0;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(
        () => {
          func(...args);
          lastExecTime = Date.now();
          timeoutId = null;
        },
        delay - (currentTime - lastExecTime),
      );
    }
  };
}

/**
 * Simple debounce function (no external dependencies)
 * Ensures function is called only after delay period of inactivity
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => func(...args), delay);
  };
}

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
