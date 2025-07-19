import type { DOMKeyframesDefinition, KeyframeOptions } from "motion";

import type { MosOptions } from "./types.js";
export const DATA_PREFIX = "mos";

/**
 * Default options for MOS, based on AOS defaults
 */
export const DEFAULT_OPTIONS: MosOptions = {
  offset: 120,
  duration: 400,
  distance: 100,
  delay: 0,
  easing: "ease",
  once: false,
  disable: false,
  disableMutationObserver: false,
  timeUnits: "ms",
  /** DOM event that triggers MOS to start */
  startEvent: "DOMContentLoaded",
};

/**
 * Common easing keywords mapped to their cubic-bezier equivalents (ported from AOS),
 * in addition to the standard supported functions from motion
 */
export const EASINGS: Record<string, KeyframeOptions["ease"]> = {
  linear: "linear",
  ease: undefined, // this is how motion represents "ease"
  "ease-in": "easeIn",
  "ease-out": "easeOut",
  "ease-in-out": "easeInOut",
  "circ-in": "circIn",
  "circ-out": "circOut",
  "circ-in-out": "circInOut",
  "back-in": "backIn",
  "back-out": "backOut",
  "back-in-out": "backInOut",
  anticipate: "anticipate",

  "ease-in-back": [0.6, -0.28, 0.735, 0.045],
  "ease-out-back": [0.175, 0.885, 0.32, 1.275],
  "ease-in-out-back": [0.68, -0.55, 0.265, 1.55],

  "ease-in-sine": [0.47, 0, 0.745, 0.715],
  "ease-out-sine": [0.39, 0.575, 0.565, 1],
  "ease-in-out-sine": [0.445, 0.05, 0.55, 0.95],

  "ease-in-quad": [0.55, 0.085, 0.68, 0.53],
  "ease-out-quad": [0.25, 0.46, 0.45, 0.94],
  "ease-in-out-quad": [0.455, 0.03, 0.515, 0.955],

  "ease-in-cubic": [0.55, 0.085, 0.68, 0.53],
  "ease-out-cubic": [0.25, 0.46, 0.45, 0.94],
  "ease-in-out-cubic": [0.455, 0.03, 0.515, 0.955],

  "ease-in-quart": [0.55, 0.085, 0.68, 0.53],
  "ease-out-quart": [0.25, 0.46, 0.45, 0.94],
  "ease-in-out-quart": [0.455, 0.03, 0.515, 0.955],
} as const;
export type EasingKeyword = keyof typeof EASINGS;

// Built-in animation presets
export const KEYFRAMES_PRESETS: Record<string, DOMKeyframesDefinition> = {
  fade: { opacity: [0, 1] },
  "fade-up": { opacity: [0, 1], translateY: [100, 0] },
  "fade-down": { opacity: [0, 1], translateY: [-100, 0] },
  "fade-left": { opacity: [0, 1], translateX: [100, 0] },
  "fade-right": { opacity: [0, 1], translateX: [-100, 0] },
  // Diagonal fades
  "fade-up-right": { opacity: [0, 1], translateY: [100, 0], translateX: [-100, 0] },
  "fade-up-left": { opacity: [0, 1], translateY: [100, 0], translateX: [100, 0] },
  "fade-down-right": { opacity: [0, 1], translateY: [-100, 0], translateX: [-100, 0] },
  "fade-down-left": { opacity: [0, 1], translateY: [-100, 0], translateX: [100, 0] },
  // Flip
  "flip-up": { perspective: [2500, 2500], rotateX: [-100, 0] },
  "flip-down": { perspective: [2500, 2500], rotateX: [100, 0] },
  "flip-left": { perspective: [2500, 2500], rotateY: [100, 0] },
  "flip-right": { perspective: [2500, 2500], rotateY: [-100, 0] },
  // Slide (no opacity change)
  "slide-up": { translateY: [100, 0] },
  "slide-down": { translateY: [-100, 0] },
  "slide-left": { translateX: [100, 0] },
  "slide-right": { translateX: [-100, 0] },
  // Zoom in/out
  "zoom-in": { opacity: [0, 1], scale: [0.6, 1] },
  "zoom-in-up": { opacity: [0, 1], scale: [0.6, 1], translateY: [100, 0] },
  "zoom-in-down": { opacity: [0, 1], scale: [0.6, 1], translateY: [-100, 0] },
  "zoom-in-left": { opacity: [0, 1], scale: [0.6, 1], translateX: [100, 0] },
  "zoom-in-right": { opacity: [0, 1], scale: [0.6, 1], translateX: [-100, 0] },
  "zoom-out": { opacity: [0, 1], scale: [1.2, 1] },
  "zoom-out-up": { opacity: [0, 1], scale: [1.2, 1], translateY: [100, 0] },
  "zoom-out-down": { opacity: [0, 1], scale: [1.2, 1], translateY: [-100, 0] },
  "zoom-out-left": { opacity: [0, 1], scale: [1.2, 1], translateX: [100, 0] },
  "zoom-out-right": { opacity: [0, 1], scale: [1.2, 1], translateX: [-100, 0] },
};
