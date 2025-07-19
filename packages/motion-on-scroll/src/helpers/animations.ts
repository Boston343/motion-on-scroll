import { animate, type AnimationPlaybackControls, type KeyframeOptions } from "motion";

import { DEFAULT_OPTIONS } from "./constants.js";
import { resolveEasing } from "./easing.js";
import { resolveKeyframes } from "./keyframes.js";
import type { ElementOptions } from "./types.js";

const running = new WeakMap<HTMLElement, AnimationPlaybackControls>();

// ------------------- Custom animation registry -------------------
export type AnimationFactory = (el: HTMLElement, opts: ElementOptions) => AnimationPlaybackControls;

const customAnimations: Record<string, AnimationFactory> = {};

/**
 * Register a fully custom animation by name.
 * The factory receives the element and resolved ElementOptions and must return
 * Motion's AnimationPlaybackControls. Must be called **before** `MOS.init()`
 * so the observer can pick it up when elements are observed.
 * Supplying the same name twice will overwrite the previous definition.
 */
export function registerAnimation(name: string, factory: AnimationFactory): void {
  if (!name || name.trim() === "") throw new Error("Custom animation name must be non-empty");
  customAnimations[name] = factory;
}

export function play(el: HTMLElement, opts: ElementOptions): void {
  const existing = running.get(el);
  if (existing) return; // already animating

  // If a user-registered custom animation exists for this key, use it and skip
  // the built-in keyframe/easing logic entirely.
  const custom = customAnimations[opts.keyframes];
  if (custom) {
    // mark element as animating so CSS can reveal it
    el.classList.add("mos-animate");

    const controls = custom(el, opts);
    running.set(el, controls);

    controls.finished.then(() => {
      if (opts.once) {
        controls.stop();
      } else {
        running.delete(el);
      }
    });
    return;
  }

  const resolvedKeyframes = resolveKeyframes(opts.keyframes);
  let keyframes = resolvedKeyframes;

  // Override travel distance for directional presets
  if (opts.distance != null && opts.distance !== DEFAULT_OPTIONS.distance) {
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
  }

  // mark element as animating so CSS can reveal it
  el.classList.add("mos-animate");

  // Resolve easing to ensure validity and provide fallback
  let easing = resolveEasing(opts.easing);
  if (opts.easing && easing === null) {
    console.warn(
      `[MOS] Invalid easing "${String(opts.easing)}" – falling back to default "${DEFAULT_OPTIONS.easing}".`,
    );
    easing = resolveEasing(DEFAULT_OPTIONS.easing);
  }
  // After fallback, ensure we never pass null; default to undefined (ease) if still null
  if (easing === null) easing = undefined;

  const controls = animate(el, keyframes, {
    // motion uses seconds so convert if needed
    duration: opts.timeUnits === "s" ? opts.duration : opts.duration / 1000,
    delay: opts.timeUnits === "s" ? opts.delay : opts.delay / 1000,
    ease: easing,
    fill: "both",
  } as KeyframeOptions);

  running.set(el, controls);

  controls.finished.then(() => {
    if (opts.once) {
      controls.stop();
    } else {
      running.delete(el);
    }
  });
}

export function reset(el: HTMLElement): void {
  const controls = running.get(el);
  if (controls) {
    controls.stop();
    running.delete(el);
  }
  el.classList.remove("mos-animate");
  el.style.opacity = "";
  el.style.transform = "";
}
