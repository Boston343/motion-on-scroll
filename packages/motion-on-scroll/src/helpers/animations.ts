// ===================================================================
// ANIMATION CONTROL SYSTEM
// ===================================================================
// This module manages animation creation, playback, and state for
// Motion-on-Scroll elements. It handles both built-in animations
// and custom user-registered animations.

import { animate, type AnimationPlaybackControls, type KeyframeOptions } from "motion";

import { DEFAULT_OPTIONS } from "./constants.js";
import { resolveEasing } from "./easing.js";
import { getKeyframesWithDistance, resolveKeyframes } from "./keyframes.js";
import type { AnimationFlags, ElementOptions } from "./types.js";

// ===================================================================
// TYPES AND INTERFACES
// ===================================================================

/**
 * Factory function type for creating custom animations
 * Takes an element and options, returns Motion's animation controls
 */
export type AnimationFactory = (el: HTMLElement, opts: ElementOptions) => AnimationPlaybackControls;

/**
 * Internal state tracking for each animated element
 */
interface ElementAnimationState extends AnimationFlags {
  /** Whether the element has been animated at least once */
  animated: boolean;
  /** Whether the element is currently playing a reverse animation */
  isReversing: boolean;
  /** The Motion animation controls for this element */
  controls?: AnimationPlaybackControls;
}

// ===================================================================
// MODULE STATE
// ===================================================================

/**
 * Maps elements to their currently running animation controls
 * Used to track which elements are actively animating
 */
const activeAnimations = new WeakMap<HTMLElement, AnimationPlaybackControls>();

/**
 * Maps elements to their animation state and controls
 * Stores persistent state across animation cycles
 */
const elementAnimationStates = new WeakMap<HTMLElement, ElementAnimationState>();

/**
 * Registry of custom animations registered by users
 * Maps animation names to their factory functions
 */
const customAnimationRegistry: Record<string, AnimationFactory> = {};

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
  const existingState = elementAnimationStates.get(element);

  // Return existing controls if available
  if (existingState?.controls) {
    return existingState.controls;
  }

  // Create new animation controls
  const controls = createAnimationControls(element, options);
  if (!controls) return null;

  // Store state with new controls
  elementAnimationStates.set(element, {
    animated: false,
    isReversing: false,
    controls,
  });

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
 * @param element - The DOM element to set initial state for
 * @param options - Animation configuration options
 */
export function setInitialState(element: HTMLElement, options: ElementOptions): void {
  // Skip if element is currently animating
  if (activeAnimations.has(element)) return;

  const controls = ensureAnimationControls(element, options);
  if (!controls) return;

  // Pause controls without setting time to preserve natural element position
  // This is crucial for accurate scroll position calculations
  controls.pause();

  // Update element state
  const state = elementAnimationStates.get(element)!;
  state.animated = false;
  state.isReversing = false;
}

/**
 * Sets up a single completion handler for animation controls
 * Uses element state to determine whether to handle forward or reverse completion
 *
 * @param element - The DOM element being animated
 * @param controls - The animation controls to set up handler for
 * @param options - Animation configuration options
 */
function setupAnimationCompletionHandler(
  element: HTMLElement,
  controls: AnimationPlaybackControls,
  options: ElementOptions,
): void {
  controls.finished
    .then(() => {
      const state = elementAnimationStates.get(element);
      if (!state) return;

      if (state.isReversing) {
        handleReverseAnimationCompletion(element, controls, state);
      } else {
        handleForwardAnimationCompletion(element, controls, options);
      }
    })
    .catch(() => {
      handleAnimationInterruption(element);
    });
}

/**
 * Handles completion of a reverse animation
 * Resets element to initial state and calls completion callback
 */
function handleReverseAnimationCompletion(
  element: HTMLElement,
  controls: AnimationPlaybackControls,
  state: ElementAnimationState,
): void {
  // Reset animation to initial state
  controls.time = 0;
  controls.pause();
  activeAnimations.delete(element);
  element.classList.remove("mos-animate");

  // Update state
  state.isReversing = false;
  state.animated = false;

  // Call reverse completion callback if stored
  const reverseCallback = (state as any).reverseCallback;
  if (reverseCallback) {
    reverseCallback();
    delete (state as any).reverseCallback;
  }
}

/**
 * Handles completion of a forward animation
 * Cleans up active animation tracking
 */
function handleForwardAnimationCompletion(
  element: HTMLElement,
  controls: AnimationPlaybackControls,
  options: ElementOptions,
): void {
  if (options.once) {
    // Stop animation permanently for once-only animations
    controls.stop();
  }

  // Remove from active animations
  activeAnimations.delete(element);
}

/**
 * Handles animation interruption (cancellation, errors, etc.)
 * Cleans up state to prevent memory leaks
 */
function handleAnimationInterruption(element: HTMLElement): void {
  const state = elementAnimationStates.get(element);
  if (state) {
    state.isReversing = false;
    delete (state as any).reverseCallback;
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
  const controls = factory(element, options);
  setupAnimationCompletionHandler(element, controls, options);
  return controls;
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
  const controls = animate(element, keyframes, {
    duration: options.timeUnits === "s" ? options.duration : options.duration / 1000,
    delay: options.timeUnits === "s" ? options.delay : options.delay / 1000,
    ease: easing,
    fill: "both",
  } as KeyframeOptions);

  // Set up completion handling
  setupAnimationCompletionHandler(element, controls, options);

  return controls;
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
 * @param element - The DOM element to set final state for
 * @param options - Animation configuration options
 */
export function setFinalState(element: HTMLElement, options: ElementOptions): void {
  const controls = ensureAnimationControls(element, options);
  if (!controls) return;

  // Use Motion's complete() method to properly reach final state
  // This ensures the animation is in the correct state for smooth reversal
  controls.complete();

  // Mark element as animated and add CSS class
  element.classList.add("mos-animate");

  // Update element state
  const state = elementAnimationStates.get(element)!;
  state.animated = true;
  state.isReversing = false;
}

// ===================================================================
// ANIMATION PLAYBACK CONTROL
// ===================================================================

/**
 * Plays the animation for an element in the forward direction
 * Creates animation controls if they don't exist, otherwise reuses existing ones
 *
 * @param element - The DOM element to animate
 * @param options - Animation configuration options
 */
export function play(element: HTMLElement, options: ElementOptions): void {
  // Ensure animation controls exist
  const controls = ensureAnimationControls(element, options);
  if (!controls) return;

  const existingAnimation = activeAnimations.get(element);
  const state = elementAnimationStates.get(element);

  // Don't interrupt if already animating forward
  if (!state || (existingAnimation && !state.isReversing)) return;

  // Configure for forward playback
  controls.speed = 1;
  controls.play();

  // Update state
  state.animated = true;
  state.isReversing = false;

  // Add CSS class for styling and mark as actively animating
  element.classList.add("mos-animate");
  activeAnimations.set(element, controls);
}

/**
 * Reverses the animation for an element (used for scroll up behavior)
 * Uses negative playback speed to smoothly reverse the animation
 *
 * @param element - The DOM element to reverse animation for
 * @param onComplete - Optional callback to call when reverse completes
 */
export function reverse(element: HTMLElement, onComplete?: () => void): void {
  const state = elementAnimationStates.get(element);
  if (!state?.controls) return;

  const controls = state.controls;

  // Configure for reverse playback
  state.isReversing = true;
  controls.speed = -1;
  controls.play();

  // Store completion callback for later execution
  if (onComplete) {
    (state as any).reverseCallback = onComplete;
  }

  // Mark as actively animating
  activeAnimations.set(element, controls);
}

export default {
  play,
  reverse,
  setFinalState,
  setInitialState,
  registerAnimation,
};
