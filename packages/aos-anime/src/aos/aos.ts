/**
 * *******************************************************
 * * AOS (Animate on scroll) - but using AnimeJS for animations
 * * made to animate elements on scroll in both directions
 * *******************************************************
 *
 * It is largely based off of AOS code, with modifications to use AnimeJS for the animations instead of pure CSS.
 * Why? Because AOS had issues with view transitions, and AnimeJS does not. Also, AOS hasn't been updated in 6 years.
 *
 * It works off of data attributes on elements:
 * - data-aos = animation name. Currently supports
 *      Fades: fade-up, fade-down, fade-left, fade-right, fade-in, fade-up-right, fade-up-left, fade-down-right, fade-down-left
 *      Flips: flip-up, flip-down, flip-left, flip-right
 *      Slides: slide-up, slide-down, slide-left, slide-right
 *      Zooms: zoom-in, zoom-in-up, zoom-in-down, zoom-in-left, zoom-in-right, zoom-out, zoom-out-up, zoom-out-down, zoom-out-left, zoom-out-right
 * - data-aos-delay = delay to wait to start animation after triggered (seconds)
 * - data-aos-duration = duration of animation (seconds)
 * - data-aos-distance = distance for animation travel (pixels)
 * - data-aos-trigger = selector of element to trigger animation on, if not the element itself (usually an id like "#hero1")
 * - data-aos-once = if you have options.once set to false, then this will make an individual element animation only happen once ("true" or "false")
 * - data-aos-mirror = this will make an individual element animate when scrolling up as well as down ("true" or "false"). Requires options.once set to false
 */

// Modules & helpers
import debounce from "lodash.debounce";
import throttle from "lodash.throttle";

import { type AOSDefaultOptions, type AOSElement } from "./helpers/aosTypes.js";
import detect from "./helpers/detector.js";
import elements from "./helpers/elements.js";
import handleScroll from "./helpers/handleScroll.js";
import { getPositionIn, getPositionOut } from "./helpers/offsetCalculator.js";
import prepare from "./helpers/prepare.js";
import observer from "./libs/observer.js";

/**
 * Private variables
 */
let aosElements = [] as AOSElement[];
let initialized = false;

/**
 * Default options, can be overwritten in the init method
 */
let options: AOSDefaultOptions = {
  offset: 100, // pixels of offet for triggering (from bottom of viewport)
  delay: 0, // delay before animation executes once triggered
  duration: 0.8, // seconds the animation lasts
  distance: 20, // distance the animation should travel (pixels)
  once: false, // whether animation should happen only once - while scrolling down
  mirror: false, // whether elements should animate when scrolling up as well as down
  easing: "easeOutCubic", // easing function, see https://animejs.com/documentation/#linearEasing for other easing options
  disable: false, // if animations should be disabled
  anchorPlacement: "top-bottom",
  startEvent: "DOMContentLoaded", // if you need a different start event from DOMContentLoaded. Recommend not changing this
  animatedClassName: "aos-animate", // always at least include "aos-animate" for CSS purposes
  initClassName: "aos-init", // uneccesary but leaving it for now
  disableMutationObserver: true,
  throttleDelay: 99,
  debounceDelay: 50,
};

const initializeScroll = function initializeScroll() {
  // Extend elements objects in aosElements with their positions and animation
  aosElements = prepare(aosElements, options);
  // Perform scroll event, to refresh view and show/hide elements
  handleScroll(aosElements);

  /**
   * Handle scroll event to animate elements on scroll
   */
  window.addEventListener(
    "scroll",
    throttle(() => {
      // handleScroll(aosElements, options.once);
      handleScroll(aosElements);
    }, options.throttleDelay),
  );

  return aosElements;
};

/**
 * Refresh AOS
 */
const refresh = function refresh(initialize = false) {
  // Allow refresh only when it was first initialized on startEvent
  // console.log("refresh");
  if (initialize) initialized = true;
  if (initialized) initializeScroll();
};

/**
 * Recalculate element positions
 */
const recalculatePositions = function recalculate() {
  if (initialized) {
    aosElements.forEach((el) => {
      el.position = {
        in: getPositionIn(el.node, options.offset, options.anchorPlacement),
        out: options.mirror && getPositionOut(el.node, options.offset),
      };
    });
    // Perform scroll event, to refresh view and show/hide elements
    handleScroll(aosElements);
  }
};

/**
 * Hard refresh
 * create array with new elements and trigger refresh
 */
const refreshHard = function refreshHard() {
  // console.log("refresh hard");
  aosElements = elements();

  if (isDisabled(options.disable)) {
    return disable();
  }

  refresh();
};

/**
 * Disable AOS
 * Remove all attributes to reset applied styles
 */
const disable = function () {
  aosElements.forEach((el) => {
    el.node.removeAttribute("data-aos");
    el.node.removeAttribute("data-aos-delay");
    el.node.removeAttribute("data-aos-distance");
    el.node.removeAttribute("data-aos-duration");

    if (options.initClassName) {
      el.node.classList.remove(options.initClassName);
    }

    if (options.animatedClassName) {
      el.node.classList.remove(options.animatedClassName);
    }
  });
};

/**
 * Check if AOS should be disabled based on provided setting
 */
const isDisabled = function (optionDisable) {
  return (
    optionDisable === true ||
    (optionDisable === "mobile" && detect.mobile()) ||
    (optionDisable === "phone" && detect.phone()) ||
    (optionDisable === "tablet" && detect.tablet()) ||
    (typeof optionDisable === "function" && optionDisable() === true)
  );
};

/**
 * Initializing AOS
 * - Create options merging defaults with user defined options
 * - Set attributes on <body> as global setting - css relies on it
 * - Attach preparing elements to options.startEvent,
 *   window resize and orientation change
 * - Attach function that handle scroll and everything connected to it
 *   to window scroll event and fire once document is ready to set initial state
 */
const init = function init(settings?: Partial<AOSDefaultOptions>) {
  options = Object.assign(options, settings);

  // Create initial array with elements -> to be fullfilled later with prepare()
  aosElements = elements();

  /**
   * Disable mutation observing if not supported
   */
  if (!options.disableMutationObserver && !observer.isSupported()) {
    console.info(`
      aos: MutationObserver is not supported on this browser,
      code mutations observing has been disabled.
      You may have to call "refreshHard()" by yourself.
    `);
    options.disableMutationObserver = true;
  }

  /**
   * Observe [aos] elements
   * If something is loaded by AJAX
   * it'll refresh plugin automatically
   */
  if (!options.disableMutationObserver) {
    observer.ready("[data-aos]", refreshHard);
  }

  /**
   * Don't init plugin if option `disable` is set
   */
  if (isDisabled(options.disable)) {
    return disable();
  }

  /**
   * Handle initializing
   */
  if (["DOMContentLoaded", "load"].indexOf(options.startEvent) === -1) {
    // Listen to options.startEvent and initialize AOS
    document.addEventListener(options.startEvent, function () {
      refresh(true);
    });
  } else {
    // window.addEventListener("load", function () {
    //   refresh(true);
    // });
    window.addEventListener("DOMContentLoaded", function () {
      refresh(true);
    });
  }

  /**
   * Recalculate positions of elements on window resize or orientation change
   */
  window.addEventListener("resize", debounce(recalculatePositions, options.debounceDelay, true));

  window.addEventListener(
    "orientationchange",
    debounce(recalculatePositions, options.debounceDelay, true),
  );

  return aosElements;
};

/**
 * Export Public API
 */

export default {
  init,
  refresh,
  refreshHard,
};
