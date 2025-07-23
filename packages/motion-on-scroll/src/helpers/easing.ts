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

  // 1. Keyword mapping (check custom easings first, then built-in)
  if (Object.prototype.hasOwnProperty.call(customEasings, input)) return customEasings[input];

  if (Object.prototype.hasOwnProperty.call(EASINGS, input))
    return EASINGS[input as keyof typeof EASINGS];

  const candidate = input.trim();

  // 2. cubic-bezier() string → array
  const cubicMatch = candidate.match(
    /cubic-bezier\s*\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/,
  );
  if (cubicMatch) {
    const nums = cubicMatch.slice(1, 5).map(Number);
    if (nums.length === 4 && nums.every((n) => Number.isFinite(n))) {
      return nums as [number, number, number, number];
    }
  }

  // 3. Bare/Bracketed array
  const arrayMatch = candidate.match(
    /^[\s[]*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)[\s\]]*$/,
  );
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
