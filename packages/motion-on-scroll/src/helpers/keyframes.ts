import type { DOMKeyframesDefinition } from "motion";

import { KEYFRAMES_PRESETS } from "./constants.js";

// ------------------- Custom preset registry -------------------
const customKeyframes: Record<string, DOMKeyframesDefinition> = {};

/**
 * Register custom animation keyframes by name.
 * Must be called **before** `MOS.init()` so the name can be picked up when elements are observed.
 * Supplying the same name twice will overwrite the previous definition.
 */
export function registerKeyframes(name: string, definition: DOMKeyframesDefinition): void {
  if (!name || name.trim() === "") throw new Error("Custom keyframes name must be non-empty");
  customKeyframes[name] = definition;
}

/**
 * Resolve a preset first from user-registered presets, then fall back to built-ins.
 */
export function resolveKeyframes(name: string): DOMKeyframesDefinition {
  return (
    customKeyframes[name] ??
    KEYFRAMES_PRESETS[name] ??
    (KEYFRAMES_PRESETS.fade as DOMKeyframesDefinition)
  );
}
