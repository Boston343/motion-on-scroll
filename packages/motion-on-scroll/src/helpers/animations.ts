// ===================================================================
// ANIMATION CONTROL SYSTEM
// ===================================================================
// This module manages animation creation, playback, and state for
// Motion-on-Scroll elements. It handles both built-in animations
// and custom user-registered animations.

import { animate, type AnimationPlaybackControls } from "motion";

import { DEFAULT_OPTIONS } from "./constants.js";
import { resolveEasing } from "./easing.js";
import { findPreparedElement } from "./elements.js";
import { getKeyframesWithDistance, resolveKeyframes } from "./keyframes.js";
import type { ElementOptions, MosElement } from "./types.js";

// ===================================================================
// TYPES AND INTERFACES
// ===================================================================

/**
 * Factory function type for creating custom animations
 * Takes an element and options, returns Motion's animation controls
 */
export type AnimationFactory = (el: HTMLElement, opts: ElementOptions) => AnimationPlaybackControls;

// ===================================================================
// MODULE STATE
// ===================================================================

/**
 * Registry of custom animations registered by users
 * Maps animation names to their factory functions
 */
const customAnimationRegistry: Record<string, AnimationFactory> = {};

/**
 * Timers of elements that are waiting out their delay before animating in
 * Keyed by DOM element, because element records are re-created on every refresh
 */
const pendingShows = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Cancels a pending delayed show for an element
 * @returns Whether there was one to cancel
 */
export function cancelPendingShow(mosElement: MosElement): boolean {
  const timer = pendingShows.get(mosElement.element);
  if (timer === undefined) return false;

  clearTimeout(timer);
  pendingShows.delete(mosElement.element);
  return true;
}

/**
 * The show delay of an element in ms
 */
function getShowDelay(options: ElementOptions): number {
  return options.timeUnits === "s" ? options.delay * 1000 : options.delay;
}

// ===================================================================
// CUSTOM ANIMATION REGISTRATION
// ===================================================================

/**
 * Registers a custom animation that can be used by name in data-mos attributes
 * The factory function receives the element and options, and must return Motion's AnimationPlaybackControls
 *
 * @param name - Unique name for the animation (used in data-mos="name")
 * @param factory - Function that creates and returns animation controls
 *
 * @example
 * ```typescript
 * registerAnimation('customSlide', (element, options) => {
 *   return animate(element, { x: [100, 0] }, { duration: options.duration });
 * });
 * ```
 *
 * @throws Error if name is empty or invalid
 */
export function registerAnimation(name: string, factory: AnimationFactory): void {
  if (!name || name.trim() === "") {
    throw new Error("Custom animation name must be non-empty");
  }
  customAnimationRegistry[name] = factory;
}

// ===================================================================
// ANIMATION CONTROL MANAGEMENT
// ===================================================================

/**
 * Ensures animation controls exist for an element, creating them only once
 * Subsequent calls return the existing controls for performance
 *
 * @param element - The DOM element to ensure animation for
 * @param options - Animation configuration options
 * @returns Animation controls or null if creation failed
 */
function ensureAnimationControls(
  element: HTMLElement,
  options: ElementOptions,
): AnimationPlaybackControls | null {
  const mosElement = findPreparedElement(element);
  if (!mosElement) return null;

  // Return existing controls if available
  if (mosElement.controls) {
    return mosElement.controls;
  }

  // Create new animation controls
  const controls = createAnimationControls(element, options);
  if (!controls) return null;

  // Store controls in unified element
  mosElement.controls = controls;

  return controls;
}

// ===================================================================
// ANIMATION STATE SETTERS
// ===================================================================

/**
 * Sets an element to its initial animation state without playing the animation
 * Creates animation controls but preserves natural position for accurate scroll calculations
 * CSS handles initial visibility (opacity: 0, visibility: hidden, etc.)
 *
 * Only acts the first time it is called for an element. Once controls exist the
 * element is either waiting at its start or animating out, and must be left alone.
 *
 * @param mosElement - The MOS element data containing element, options, and state
 */
export function setInitialState(mosElement: MosElement): void {
  if (mosElement.controls) return;

  const { element, options } = mosElement;

  const controls = ensureAnimationControls(element, options);
  if (!controls) return;

  // Pause controls without setting time to preserve natural element position
  // This is crucial for accurate scroll position calculations
  controls.pause();
  releaseIdleFrameLoop(controls);

  mosElement.animated = false;
}

/**
 * Stops the frame loop of a paused animation once its first frame is on screen
 *
 * Motion keeps a requestAnimationFrame loop running for every paused JS-driven
 * (transform) animation, so a page full of elements waiting below the fold would
 * tick 60 times a second for nothing. Motion has no public way to park a paused
 * animation, so this reaches for its internal `stopDriver()`; if that ever goes
 * away this silently does nothing and the animations simply keep ticking as before.
 * Motion starts a fresh loop by itself on the next play().
 */
function releaseIdleFrameLoop(controls: AnimationPlaybackControls): void {
  type Parkable = { state?: string; stopDriver?: () => void };
  type Wrapper = { animation?: Parkable };

  // animate() returns a group of per-value animations, each wrapping the real one
  const group = (controls as { animations?: Wrapper[] }).animations ?? [controls as Wrapper];

  // Two frames, so the paused first frame has been rendered before the loop stops
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      group.forEach((wrapper) => {
        const animation = wrapper.animation ?? (wrapper as Parkable);
        if (animation.state === "paused") animation.stopDriver?.();
      });
    }),
  );
}

// ===================================================================
// CLASS NAMES AND EVENTS
// ===================================================================

/**
 * Class names toggled on an element while it is animated in
 */
function getAnimatedClassNames(options: ElementOptions): string[] {
  const classNames: string[] = [];
  if (options.animatedClassName) classNames.push(options.animatedClassName);
  if (options.useClassNames) classNames.push(...options.keyframes.split(/\s+/).filter(Boolean));
  return classNames;
}

/**
 * Dispatches `mos:in` / `mos:out` on the document (like AOS's `aos:in` / `aos:out`),
 * plus `mos:in:<id>` / `mos:out:<id>` when the element has a `data-mos-id`
 */
function dispatchMosEvent(type: "in" | "out", mosElement: MosElement): void {
  const { element, options } = mosElement;
  document.dispatchEvent(new CustomEvent(`mos:${type}`, { detail: element }));
  if (options.id) {
    document.dispatchEvent(new CustomEvent(`mos:${type}:${options.id}`, { detail: element }));
  }
}

// ===================================================================
// ANIMATION CREATION
// ===================================================================

/**
 * Creates animation controls for an element without starting playback
 * Handles both custom animations and built-in keyframe animations
 *
 * @param element - The DOM element to create animation for
 * @param options - Animation configuration options
 * @returns Animation controls or null if creation failed
 */
function createAnimationControls(
  element: HTMLElement,
  options: ElementOptions,
): AnimationPlaybackControls | null {
  // Check for custom animation first
  const customAnimation = customAnimationRegistry[options.keyframes];
  if (customAnimation) {
    return createCustomAnimation(element, options, customAnimation);
  }

  // Create built-in keyframe animation
  return createKeyframeAnimation(element, options);
}

/**
 * Creates a custom animation using a registered animation factory
 * @param element - The DOM element to animate
 * @param options - Animation configuration options
 * @param factory - The custom animation factory function
 * @returns Animation controls from the custom factory
 */
function createCustomAnimation(
  element: HTMLElement,
  options: ElementOptions,
  factory: AnimationFactory,
): AnimationPlaybackControls {
  // MOS applies the show delay itself (see play()), exactly as for built-in animations.
  // The factory therefore gets a delay of 0: one that forwards `opts.delay` to Motion
  // would otherwise delay twice, and replay the delay when the animation is reversed.
  return factory(element, { ...options, delay: 0 });
}

/**
 * Creates a built-in keyframe animation using Motion's animate function
 * @param element - The DOM element to animate
 * @param options - Animation configuration options
 * @returns Animation controls from Motion
 */
function createKeyframeAnimation(
  element: HTMLElement,
  options: ElementOptions,
): AnimationPlaybackControls {
  // Resolve keyframes for the animation
  const keyframes = resolveAnimationKeyframes(options);

  // Resolve easing function
  const easing = resolveAnimationEasing(options);

  // Create animation with Motion
  // The delay is deliberately not handed to Motion: it would become part of the
  // timeline and be replayed (in the wrong place) when the animation is reversed.
  // play() applies it instead, so like AOS there is no delay when animating out.
  return animate(element, keyframes, {
    duration: options.timeUnits === "s" ? options.duration : options.duration / 1000,
    ease: easing,
    autoplay: false,
  });
}

/**
 * Resolves and processes keyframes for an animation
 * Applies custom distance if specified
 * @param options - Animation configuration options
 * @returns Processed keyframes ready for Motion
 */
function resolveAnimationKeyframes(options: ElementOptions): any {
  const resolvedKeyframes = resolveKeyframes(options.keyframes);

  // Apply custom distance if different from default
  if (options.distance != null && options.distance !== DEFAULT_OPTIONS.distance) {
    return getKeyframesWithDistance(options, resolvedKeyframes);
  }

  return resolvedKeyframes;
}

/**
 * Resolves the easing function for an animation
 * Handles fallback to default easing if invalid
 * @param options - Animation configuration options
 * @returns Resolved easing function or undefined
 */
function resolveAnimationEasing(options: ElementOptions): any {
  let easing = resolveEasing(options.easing);

  // Handle invalid easing with fallback
  if (options.easing && easing === null) {
    console.warn(
      `[MOS] Invalid easing "${String(options.easing)}" – falling back to default "${DEFAULT_OPTIONS.easing}".`,
    );
    easing = resolveEasing(DEFAULT_OPTIONS.easing);
  }

  return easing === null ? undefined : easing;
}

/**
 * Sets an element to its final animation state instantly
 * Used for elements that are above the viewport on page load
 * Uses Motion's complete() method to properly set final state for smooth reversal
 *
 * @param mosElement - The MOS element data containing element, options, and state
 */
export function setFinalState(mosElement: MosElement): void {
  const { element, options } = mosElement;

  const controls = ensureAnimationControls(element, options);
  if (!controls) return;

  // Use Motion's complete() method to properly reach final state
  // This ensures the animation is in the correct state for smooth reversal
  // (forward speed first: completing a reversed animation would end on the hidden state)
  cancelPendingShow(mosElement);
  controls.speed = 1;
  controls.complete();

  element.classList.add(...getAnimatedClassNames(options));

  // Announce it like any other show (AOS fires aos:in here too), unless the element
  // was already shown and only had its animation rebuilt
  const wasAnimated = mosElement.animated;
  mosElement.animated = true;
  if (!wasAnimated) dispatchMosEvent("in", mosElement);
}

// ===================================================================
// ANIMATION PLAYBACK CONTROL
// ===================================================================

/**
 * Plays the animation for an element in the forward direction
 * Creates animation controls if they don't exist, otherwise reuses existing ones
 * If the element is part-way through animating out, it turns around from where it is
 *
 * @param mosElement - The MOS element data containing element, options, and state
 */
export function play(mosElement: MosElement): void {
  const { element, options } = mosElement;

  // Ensure animation controls exist
  const controls = ensureAnimationControls(element, options);
  if (!controls) return;

  const start = (): void => {
    pendingShows.delete(element);

    // Configure for forward playback
    controls.speed = 1;
    controls.play();
  };

  // Wait out the delay first (only on the way in, like AOS)
  cancelPendingShow(mosElement);
  const delay = getShowDelay(options);
  if (delay > 0) {
    pendingShows.set(element, setTimeout(start, delay));
  } else {
    start();
  }

  element.classList.add(...getAnimatedClassNames(options));
  mosElement.animated = true;

  dispatchMosEvent("in", mosElement);
}

/**
 * Reverses the animation for an element (used for scroll up behavior)
 * Uses negative playback speed to smoothly reverse the animation
 *
 * Like AOS, the element counts as hidden as soon as it starts animating out:
 * Motion leaves it on its first keyframe when the reversed animation ends.
 *
 * @param mosElement - The MOS element data containing element, options, and state
 */
export function reverse(mosElement: MosElement): void {
  if (!mosElement.controls) return;

  const { element, options, controls } = mosElement;

  // An element still waiting out its delay has not moved yet (or is already
  // animating out), so calling off the delayed show is all that is needed
  if (!cancelPendingShow(mosElement)) {
    // Configure for reverse playback
    controls.speed = -1;
    controls.play();
  }

  element.classList.remove(...getAnimatedClassNames(options));
  mosElement.animated = false;

  dispatchMosEvent("out", mosElement);
}

export default {
  cancelPendingShow,
  play,
  reverse,
  setFinalState,
  setInitialState,
  registerAnimation,
};
