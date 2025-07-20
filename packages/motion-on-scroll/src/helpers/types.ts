/**
 * Shared MOS TypeScript types
 */

import type { EasingKeyword } from "./constants.js";

/**
 * Represents an element being tracked for scroll-based animations
 * Contains all state and configuration needed for animation decisions
 */
export interface MosElement {
  /** The DOM element being animated */
  element: HTMLElement;
  /** Animation configuration options */
  options: ElementOptions;
  /** Scroll positions that trigger animations */
  position: {
    /** Scroll position where element should animate in */
    in: number;
    /** Scroll position where element should animate out (false if disabled) */
    out: number | false;
  };
  /** Whether the element has been animated */
  animated: boolean;
  /** Whether the element is currently reversing its animation */
  isReversing: boolean;
}

export type DeviceDisable = boolean | "mobile" | "phone" | "tablet" | (() => boolean);

export interface MosOptions {
  /** Additional px distance before an element is considered in view */
  offset: number;
  /** Animation duration default */
  duration: number;
  /** Delay before starting the animation */
  delay: number;
  /** Units for duration and delay ("ms" or "s") */
  timeUnits: "ms" | "s";
  /** Travel distance for directional animations in px */
  distance: number;
  /** CSS easing string */
  easing: EasingKeyword | string;
  /** If true, an element animates only once */
  once: boolean;
  /** If true, elements animate when scrolling up as well as down (requires once: false) */
  mirror: boolean;
  /** Disable condition */
  disable: DeviceDisable;
  /** If true, automatic DOM MutationObserver is not started */
  disableMutationObserver: boolean;
  /** DOM event that triggers MOS to start. Defaults to "DOMContentLoaded" */
  startEvent: string;
  /** Throttle delay for scroll events in ms */
  throttleDelay: number;
  /** Debounce delay for resize/orientation events in ms */
  debounceDelay: number;
}

export type AnchorPlacement =
  | "top-top"
  | "top-center"
  | "top-bottom"
  | "center-top"
  | "center-center"
  | "center-bottom"
  | "bottom-top"
  | "bottom-center"
  | "bottom-bottom";

export interface ElementOptions extends MosOptions {
  /** Preset animation name */
  keyframes: string;
  /** Selector of anchor element whose position controls trigger */
  anchor?: string;
  /** 9-grid intersection that decides when the animation triggers */
  anchorPlacement?: AnchorPlacement;
}

export type PartialMosOptions = Partial<MosOptions>;

/* These types are copied directly from motion's types as I could not find them exported */
type MarginValue = `${number}${"px" | "%"}`;
export type MarginType =
  | MarginValue
  | `${MarginValue} ${MarginValue}`
  | `${MarginValue} ${MarginValue} ${MarginValue}`
  | `${MarginValue} ${MarginValue} ${MarginValue} ${MarginValue}`;
