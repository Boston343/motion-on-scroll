import { animate, type AnimationPlaybackControls, type KeyframeOptions } from "motion";

import { DEFAULT_OPTIONS } from "./constants.js";
import { resolveEasing } from "./easing.js";
import { resolveKeyframes } from "./keyframes.js";
import type { ElementOptions } from "./types.js";

const running = new WeakMap<HTMLElement, AnimationPlaybackControls>();
const elementStates = new WeakMap<HTMLElement, {
  hasAnimated: boolean;
  isReversing: boolean;
  controls?: AnimationPlaybackControls;
}>();

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

/**
 * Set element to its initial animation state without playing the animation
 * We create the animation controls but don't apply transforms yet to preserve
 * natural position for Intersection Observer. CSS handles initial visibility.
 */
export function setInitialState(el: HTMLElement, opts: ElementOptions): void {
  // Skip if already has initial state or is currently animating
  if (elementStates.has(el) || running.has(el)) return;

  const controls = createAnimation(el, opts);
  if (!controls) return;

  // Create controls but don't set time yet - this preserves natural position
  // CSS will handle initial visibility (opacity: 0, visibility: hidden, etc.)
  controls.pause();

  // Store state
  elementStates.set(el, {
    hasAnimated: false,
    isReversing: false,
    controls
  });
}

/**
 * Create animation controls for an element without playing
 */
function createAnimation(el: HTMLElement, opts: ElementOptions): AnimationPlaybackControls | null {
  // Handle custom animations
  const custom = customAnimations[opts.keyframes];
  if (custom) {
    return custom(el, opts);
  }

  const resolvedKeyframes = resolveKeyframes(opts.keyframes);
  let keyframes = resolvedKeyframes;

  // Override travel distance for directional presets
  if (opts.distance != null && opts.distance !== DEFAULT_OPTIONS.distance) {
    keyframes = getKeyframesWithDistance(opts, resolvedKeyframes);
  }

  // Resolve easing
  let easing = resolveEasing(opts.easing);
  if (opts.easing && easing === null) {
    console.warn(
      `[MOS] Invalid easing "${String(opts.easing)}" – falling back to default "${DEFAULT_OPTIONS.easing}".`,
    );
    easing = resolveEasing(DEFAULT_OPTIONS.easing);
  }
  if (easing === null) easing = undefined;

  return animate(el, keyframes, {
    duration: opts.timeUnits === "s" ? opts.duration : opts.duration / 1000,
    delay: opts.timeUnits === "s" ? opts.delay : opts.delay / 1000,
    ease: easing,
    fill: "both",
  } as KeyframeOptions);
}

/**
 * Set element to its final animation state instantly (for above-viewport elements)
 */
export function setFinalState(el: HTMLElement, opts: ElementOptions): void {
  const controls = createAnimation(el, opts);
  if (!controls) return;

  // Set animation to final time and pause
  controls.time = controls.duration;
  controls.pause();

  // Mark as animated and add animate class
  el.classList.add("mos-animate");
  elementStates.set(el, {
    hasAnimated: true,
    isReversing: false,
    controls
  });
}

/**
 * Reverse the animation (for scroll up behavior)
 */
export function reverse(el: HTMLElement): void {
  const state = elementStates.get(el);
  if (!state?.controls) return;
  
  const controls = state.controls;
  
  // Set to reverse playback
  controls.speed = -1;
  controls.play();
  state.isReversing = true;
  
  // Update running map
  running.set(el, controls);
  
  // When reverse completes, reset to initial state
  controls.finished.then(() => {
    if (state.isReversing) {
      controls.time = 0;
      controls.pause();
      running.delete(el);
      el.classList.remove("mos-animate");
      state.isReversing = false;
      state.hasAnimated = false;
    }
  });
}

/**
 * Get keyframes with custom distance applied
 */
function getKeyframesWithDistance(opts: ElementOptions, resolvedKeyframes: any): any {
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

export function play(el: HTMLElement, opts: ElementOptions): void {
  const existing = running.get(el);
  if (existing) return; // already animating
  
  const state = elementStates.get(el);
  let controls: AnimationPlaybackControls;
  
  if (state?.controls) {
    // Use existing controls and start animation from beginning
    controls = state.controls;
    controls.time = 0; // Set to initial state
    controls.speed = 1; // Ensure forward playback
    controls.play(); // Now play the animation
    state.hasAnimated = true;
    state.isReversing = false;
  } else {
    // Create new animation and play immediately
    const newControls = createAnimation(el, opts);
    if (!newControls) return;
    
    controls = newControls;
    // Animation starts playing immediately when created
    
    // Store state
    elementStates.set(el, {
      hasAnimated: true,
      isReversing: false,
      controls
    });
  }

  // mark element as animating so CSS can reveal it
  el.classList.add("mos-animate");
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
  
  const state = elementStates.get(el);
  if (state?.controls) {
    // Stop the animation and let CSS handle the reset to initial visibility
    state.controls.stop();
    state.hasAnimated = false;
    state.isReversing = false;
  } else {
    // Fallback to clearing styles
    el.style.opacity = "";
    el.style.transform = "";
  }
  
  el.classList.remove("mos-animate");
}
