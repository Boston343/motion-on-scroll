import { type KeyframeOptions } from "motion";

import { EASINGS } from "./constants.js";

/**
 * Type for custom easing definitions that can be registered
 */
export type EasingDefinition = KeyframeOptions["ease"];

/**
 * Storage for custom registered easings
 */
const customEasings: Record<string, EasingDefinition> = {};

/**
 * A signed decimal number (control points may be negative or above 1 for overshoot curves)
 */
const NUM = "(-?(?:\\d+\\.?\\d*|\\.\\d+))";
const SEP = "\\s*,\\s*";
const CUBIC_BEZIER_PATTERN = new RegExp(
  `^cubic-bezier\\s*\\(\\s*${NUM}${SEP}${NUM}${SEP}${NUM}${SEP}${NUM}\\s*\\)$`,
);
const ARRAY_PATTERN = new RegExp(`^[\\s[]*${NUM}${SEP}${NUM}${SEP}${NUM}${SEP}${NUM}[\\s\\]]*$`);

/**
 * Resolve a developer-supplied easing value into something Motion accepts.
 *
 * Accepts the following forms (mirrors MOS runtime):
 * 1. Custom easing name (registered via `registerEasing`) → cubic-bezier array
 * 2. Keyword (in EASINGS map)             → mapped cubic-bezier string
 * 3. `cubic-bezier(x1, y1, x2, y2)`       → number[4]
 * 4. `[x1,y1,x2,y2]` or `x1,y1,x2,y2`     → number[4]
 * 5. Otherwise                            → null
 */
export function resolveEasing(input: unknown): EasingDefinition | null {
  if (input == null || typeof input !== "string") return undefined;

  const candidate = input.trim();

  // 1. Keyword mapping (check custom easings first, then built-in)
  if (Object.prototype.hasOwnProperty.call(customEasings, candidate))
    return customEasings[candidate];

  if (Object.prototype.hasOwnProperty.call(EASINGS, candidate))
    return EASINGS[candidate as keyof typeof EASINGS];

  // 2. cubic-bezier() string → array
  const cubicMatch = candidate.match(CUBIC_BEZIER_PATTERN);
  if (cubicMatch) {
    const nums = cubicMatch.slice(1, 5).map(Number);
    if (nums.length === 4 && nums.every((n) => Number.isFinite(n))) {
      return nums as [number, number, number, number];
    }
  }

  // 3. Bare/Bracketed array
  const arrayMatch = candidate.match(ARRAY_PATTERN);
  if (arrayMatch) {
    const nums = arrayMatch.slice(1, 5).map(Number);
    if (nums.length === 4 && nums.every((n) => Number.isFinite(n))) {
      return nums as [number, number, number, number];
    }
  }

  // 4. Invalid → null (signals caller to fallback)
  return null;
}

/**
 * Register a custom easing function with a given name.
 *
 * Accepts Motion's easing definitions:
 * - Named strings: "easeIn", "easeOut", "linear", etc.
 * - Cubic bezier arrays: [0.25, 0.46, 0.45, 0.94]
 * - Step functions and other Motion easing types
 * - Cubic bezier strings: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
 *
 * @param name - The name to register the easing under
 * @param definition - The easing definition (Motion-compatible or cubic-bezier string)
 *
 * @example
 * ```typescript
 * // Register a cubic bezier array
 * registerEasing("bouncy", [0.68, -0.55, 0.265, 1.55]);
 *
 * // Register a cubic-bezier string (will be parsed for motion)
 * registerEasing("custom", "cubic-bezier(0.25, 0.46, 0.45, 0.94)");
 * ```
 */
export function registerEasing(name: string, definition: EasingDefinition | string): void {
  if (!name || name.trim() === "") throw new Error("Custom easing name must be non-empty");

  // If definition is a string, try to resolve it using existing parsing logic
  if (typeof definition === "string") {
    const resolved = resolveEasing(definition);
    if (resolved === null) {
      throw new Error(`Invalid easing definition: "${definition}"`);
    }
    customEasings[name] = resolved;
  } else {
    // Direct Motion easing definition (array, function, etc.)
    customEasings[name] = definition;
  }
}

export default {
  registerEasing,
  resolveEasing,
};
