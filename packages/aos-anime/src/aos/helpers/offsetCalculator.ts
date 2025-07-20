/**
 * Calculate offset
 * based on element's settings like:
 * - trigger
 * - offset
 */

import getOffset from "../libs/offset.js";
import { type TriggerPlacement } from "./aosTypes.js";
import getInlineOption from "./getInlineOption.js";

// returns the final offset that will be used to trigger animation in good position
export const getPositionIn = (
  el: HTMLElement,
  defaultOffset: number,
  defaultTriggerPlacement: TriggerPlacement,
): number => {
  const windowHeight = window.innerHeight;
  const trigger = getInlineOption(el, "trigger") as string | null;
  const inlinetriggerPlacement = getInlineOption(el, "trigger-placement");
  const additionalOffset = Number(
    getInlineOption(el, "offset", inlinetriggerPlacement ? 0 : defaultOffset),
  );
  const triggerPlacement = inlinetriggerPlacement || defaultTriggerPlacement;
  let finalEl = el;

  if (trigger && document.querySelectorAll(trigger)) {
    finalEl = document.querySelectorAll(trigger)[0] as HTMLElement;
  }

  let triggerPoint = getOffset(finalEl).top - windowHeight;

  switch (triggerPlacement) {
    case "top-bottom":
      // Default offset
      break;
    case "center-bottom":
      triggerPoint += finalEl.offsetHeight / 2;
      break;
    case "bottom-bottom":
      triggerPoint += finalEl.offsetHeight;
      break;
    case "top-center":
      triggerPoint += windowHeight / 2;
      break;
    case "center-center":
      triggerPoint += windowHeight / 2 + finalEl.offsetHeight / 2;
      break;
    case "bottom-center":
      triggerPoint += windowHeight / 2 + finalEl.offsetHeight;
      break;
    case "top-top":
      triggerPoint += windowHeight;
      break;
    case "bottom-top":
      triggerPoint += windowHeight + finalEl.offsetHeight;
      break;
    case "center-top":
      triggerPoint += windowHeight + finalEl.offsetHeight / 2;
      break;
  }

  return triggerPoint + additionalOffset;
};

export const getPositionOut = (el: HTMLElement, defaultOffset: number): number => {
  const trigger = getInlineOption(el, "trigger") as string;
  const additionalOffset = getInlineOption(el, "offset", defaultOffset) as number;
  let finalEl = el;

  if (trigger && document.querySelectorAll(trigger)) {
    finalEl = document.querySelectorAll(trigger)[0] as HTMLElement;
  }

  const elementOffsetTop = getOffset(finalEl).top;

  return elementOffsetTop + finalEl.offsetHeight - additionalOffset;
};
