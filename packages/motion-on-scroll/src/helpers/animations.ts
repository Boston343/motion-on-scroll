import { animate, type AnimationPlaybackControls, type KeyframeOptions } from "motion";

import { DEFAULT_OPTIONS } from "./constants.js";
import { resolveEasing } from "./easing.js";
import { getKeyframesWithDistance, resolveKeyframes } from "./keyframes.js";
import type { ElementOptions } from "./types.js";

const running = new WeakMap<HTMLElement, AnimationPlaybackControls>();
const elementStates = new WeakMap<
  HTMLElement,
  {
    hasAnimated: boolean;
    isReversing: boolean;
    controls?: AnimationPlaybackControls;
  }
>();

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
 * Ensure animation controls exist for an element (create only once)
 */
function ensureAnimation(el: HTMLElement, opts: ElementOptions): AnimationPlaybackControls | null {
  const existingState = elementStates.get(el);
  if (existingState?.controls) {
    return existingState.controls;
  }

  const controls = createAnimation(el, opts);
  if (!controls) return null;

  // Store state with new controls
  elementStates.set(el, {
    hasAnimated: false,
    isReversing: false,
    controls,
  });

  return controls;
}

/**
 * Set element to its initial animation state without playing the animation
 * We create the animation controls but don't apply transforms yet to preserve
 * natural position for Intersection Observer. CSS handles initial visibility.
 */
export function setInitialState(el: HTMLElement, opts: ElementOptions): void {
  // Skip if currently animating
  if (running.has(el)) return;

  const controls = ensureAnimation(el, opts);
  if (!controls) return;

  // Create controls but don't set time yet - this preserves natural position
  // CSS will handle initial visibility (opacity: 0, visibility: hidden, etc.)
  controls.pause();

  // Update state
  const state = elementStates.get(el)!;
  state.hasAnimated = false;
  state.isReversing = false;
}

/**
 * Set up single completion handler that uses state to determine behavior
 */
function setupCompletionHandler(
  el: HTMLElement,
  controls: AnimationPlaybackControls,
  opts: ElementOptions,
): void {
  controls.finished
    .then(() => {
      const state = elementStates.get(el);
      if (!state) return;

      if (state.isReversing) {
        // Handle reverse completion

        // Reset to initial state
        controls.time = 0;
        controls.pause();
        running.delete(el);
        el.classList.remove("mos-animate");
        state.isReversing = false;
        state.hasAnimated = false;

        // Call reverse completion callback if stored
        const reverseCallback = (state as any).reverseCallback;
        if (reverseCallback) {
          reverseCallback();
          delete (state as any).reverseCallback;
        }
      } else {
        // Handle forward completion

        if (opts.once) {
          controls.stop();
          running.delete(el);
        } else {
          running.delete(el);
        }
      }
    })
    .catch(() => {
      // Animation was cancelled/interrupted - cleanup state
      const state = elementStates.get(el);
      if (state) {
        state.isReversing = false;
        delete (state as any).reverseCallback;
      }
    });
}

/**
 * Create animation controls for an element without playing
 */
function createAnimation(el: HTMLElement, opts: ElementOptions): AnimationPlaybackControls | null {
  // Handle custom animations
  const custom = customAnimations[opts.keyframes];
  if (custom) {
    const controls = custom(el, opts);
    setupCompletionHandler(el, controls, opts);
    return controls;
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

  const controls = animate(el, keyframes, {
    duration: opts.timeUnits === "s" ? opts.duration : opts.duration / 1000,
    delay: opts.timeUnits === "s" ? opts.delay : opts.delay / 1000,
    ease: easing,
    fill: "both",
  } as KeyframeOptions);

  // Set up single completion handler that checks state to determine behavior
  setupCompletionHandler(el, controls, opts);

  return controls;
}

/**
 * Set element to its final animation state instantly (for above-viewport elements)
 */
export function setFinalState(el: HTMLElement, opts: ElementOptions): void {
  const controls = ensureAnimation(el, opts);
  if (!controls) return;

  // Set animation to final time and pause
  controls.time = controls.duration;
  controls.pause();

  // Mark as animated and add animate class
  el.classList.add("mos-animate");

  // Update state
  const state = elementStates.get(el)!;
  state.hasAnimated = true;
  state.isReversing = false;
}

export function play(el: HTMLElement, opts: ElementOptions): void {
  // Ensure animation controls exist (create only once)
  const controls = ensureAnimation(el, opts);
  if (!controls) return;

  const existing = running.get(el);
  const state = elementStates.get(el);

  // If already animating but not reversing, don't interrupt
  if (!state || (existing && !state.isReversing)) return;

  // Use existing controls and start animation
  controls.speed = 1; // Ensure forward playback
  controls.play(); // Now play the animation

  // Update state (reuse existing state variable)
  // const updatedState = elementStates.get(el)!;
  state.hasAnimated = true;
  state.isReversing = false;

  // mark element as animating so CSS can reveal it
  el.classList.add("mos-animate");
  running.set(el, controls);

  // Completion is now handled by setupCompletionHandler - no need for additional promise here
}

/**
 * Reverse the animation (for scroll up behavior)
 */
export function reverse(el: HTMLElement, onComplete?: () => void): void {
  const state = elementStates.get(el);
  if (!state?.controls) return;

  const controls = state.controls;

  // Set to reverse playback
  state.isReversing = true;

  // Store the completion callback in state for the single completion handler
  if (onComplete) {
    (state as any).reverseCallback = onComplete;
  }

  controls.speed = -1;
  controls.play();

  // Update running map
  running.set(el, controls);
}
