import { registerAnimation } from "./helpers/animations.js";
import { resolveElementOptions } from "./helpers/attributes.js";
import { DEFAULT_OPTIONS } from "./helpers/constants.js";
import { registerEasing } from "./helpers/easing.js";
import { registerKeyframes } from "./helpers/keyframes.js";
import { observeElement } from "./helpers/observer.js";
import { initScrollTracker } from "./helpers/scroll-tracker.js";

// Track elements already observed to avoid duplicate observations
const _observedEls = new WeakSet<HTMLElement>();
function observeOnce(el: HTMLElement, opts: Parameters<typeof observeElement>[1]) {
  if (_observedEls.has(el)) return;
  _observedEls.add(el);
  observeElement(el, opts);
}
import type { PartialMosOptions } from "./helpers/types.js";
import { isDisabled, removeMosAttributes } from "./helpers/utils.js";

let globalOptions: PartialMosOptions = {};
// Indicates that the core observers have been started
let initialized = false;
let mo: MutationObserver | null = null;

function collectElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-mos]"));
}

function bootstrap() {
  // If already initialised by auto-init, merge new options and refresh
  if (initialized) return;
  initialized = true;

  // Global disable shortcut – strip data attributes and abort
  if (isDisabled(globalOptions.disable ?? false)) {
    collectElements().forEach(removeMosAttributes);
    return;
  }

  // Initialize scroll direction tracking
  initScrollTracker();

  // Start MutationObserver unless disabled
  if (!globalOptions.disableMutationObserver && typeof MutationObserver !== "undefined") {
    mo?.disconnect();
    mo = new MutationObserver(() => refreshHard());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Observe current elements
  collectElements().forEach((el) => {
    const opts = resolveElementOptions(el, globalOptions);
    observeOnce(el, opts);
  });
}

function init(options: PartialMosOptions = {}) {
  // Merge new options onto existing ones (later options override earlier ones)
  globalOptions = { ...globalOptions, ...options };

  // Handle alternate time units adjustment the first time init is called
  if (!initialized && globalOptions.timeUnits === "s") {
    if (globalOptions.duration == null) globalOptions.duration = DEFAULT_OPTIONS.duration / 1000;
    if (globalOptions.delay == null) globalOptions.delay = DEFAULT_OPTIONS.delay / 1000;
  }

  const startEvent = globalOptions.startEvent ?? DEFAULT_OPTIONS.startEvent;

  // If MOS has already been initialised by a previous call, just refresh and return
  if (initialized) {
    collectElements().forEach((el) => {
      const opts = resolveElementOptions(el, globalOptions);
      observeOnce(el, opts);
    });
    return;
  }

  // If the desired event has already fired, bootstrap immediately
  if (
    (startEvent === "DOMContentLoaded" &&
      ["interactive", "complete"].includes(document.readyState)) ||
    (startEvent === "load" && document.readyState === "complete")
  ) {
    bootstrap();
    return;
  }

  // Otherwise, attach listener for the start event
  if (startEvent === "load") {
    window.addEventListener(startEvent, bootstrap, { once: true });
  } else {
    document.addEventListener(startEvent, bootstrap, { once: true });
  }
}

function refreshHard() {
  // Re-run observation for all current elements with existing global options
  if (isDisabled(globalOptions.disable ?? false)) {
    collectElements().forEach(removeMosAttributes);
    return;
  }

  collectElements().forEach((el) => {
    const opts = resolveElementOptions(el, globalOptions);
    observeOnce(el, opts);
  });
}

export const MOS = { init, refreshHard, registerKeyframes, registerEasing, registerAnimation };
export { init, refreshHard, registerAnimation, registerEasing, registerKeyframes };
