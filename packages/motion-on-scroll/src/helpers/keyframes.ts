import type { DOMKeyframesDefinition } from "motion";

import { KEYFRAMES_PRESETS } from "./constants.js";
import type { ElementOptions } from "./types.js";

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

/**
 * Get keyframes with custom distance applied
 */
export function getKeyframesWithDistance(opts: ElementOptions, resolvedKeyframes: any): any {
  let keyframes = resolvedKeyframes;

  switch (opts.keyframes) {
    case "fade-up":
      keyframes = { opacity: [0, 1], translateY: [opts.distance, 0] };
      break;
    case "fade-down":
      keyframes = { opacity: [0, 1], translateY: [-opts.distance, 0] };
      break;
    case "fade-left":
      keyframes = { opacity: [0, 1], translateX: [-opts.distance, 0] };
      break;
    case "fade-right":
      keyframes = { opacity: [0, 1], translateX: [opts.distance, 0] };
      break;
    // diagonal fades
    case "fade-up-right":
      keyframes = {
        opacity: [0, 1],
        translateY: [opts.distance, 0],
        translateX: [opts.distance, 0],
      };
      break;
    case "fade-up-left":
      keyframes = {
        opacity: [0, 1],
        translateY: [opts.distance, 0],
        translateX: [-opts.distance, 0],
      };
      break;
    case "fade-down-right":
      keyframes = {
        opacity: [0, 1],
        translateY: [-opts.distance, 0],
        translateX: [opts.distance, 0],
      };
      break;
    case "fade-down-left":
      keyframes = {
        opacity: [0, 1],
        translateY: [-opts.distance, 0],
        translateX: [-opts.distance, 0],
      };
      break;
    // slides
    case "slide-up":
      keyframes = { translateY: [opts.distance, 0] };
      break;
    case "slide-down":
      keyframes = { translateY: [-opts.distance, 0] };
      break;
    case "slide-left":
      keyframes = { translateX: [-opts.distance, 0] };
      break;
    case "slide-right":
      keyframes = { translateX: [opts.distance, 0] };
      break;
    // zoom directional
    case "zoom-in-up":
    case "zoom-out-up":
      keyframes = { ...resolvedKeyframes, translateY: [opts.distance, 0] };
      break;
    case "zoom-in-down":
    case "zoom-out-down":
      keyframes = { ...resolvedKeyframes, translateY: [-opts.distance, 0] };
      break;
    case "zoom-in-left":
    case "zoom-out-left":
      keyframes = { ...resolvedKeyframes, translateX: [-opts.distance, 0] };
      break;
    case "zoom-in-right":
    case "zoom-out-right":
      keyframes = { ...resolvedKeyframes, translateX: [opts.distance, 0] };
      break;
  }

  return keyframes;
}
