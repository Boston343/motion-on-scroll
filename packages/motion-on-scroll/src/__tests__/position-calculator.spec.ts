import { JSDOM } from "jsdom";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../helpers/constants.js";
import {
  getElementOffset,
  getPositionIn,
  getPositionOut,
  isElementAboveViewport,
} from "../helpers/position-calculator.js";
import type { ElementOptions } from "../helpers/types.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

beforeAll(() => {
  const { window } = new JSDOM('<html><body><div id="app"></div></body></html>');
  // @ts-expect-error attach globals for jsdom
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
});

beforeEach(() => {
  // Reset scroll position before each test
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

function makeOpts(partial: Partial<ElementOptions> = {}): ElementOptions {
  return { ...DEFAULT_OPTIONS, ...partial } as ElementOptions;
}

/**
 * Quick helper to fabricate offset properties on an HTMLElement because jsdom
 * does not compute layout. We only need a handful of properties for the
 * calculations in position-calculator.
 */
function setOffset(el: HTMLElement, left: number, top: number, width = 0, height = 0) {
  Object.defineProperty(el, "offsetLeft", { value: left, configurable: true });
  Object.defineProperty(el, "offsetTop", { value: top, configurable: true });
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Matrix of anchorPlacement variations to validate math for getPositionIn.
// Each tuple: [anchorPlacement, expectedAdjustment]
// Base numbers used in calculation:
//   element offsetTop = 100
//   windowHeight      = 800
//   element height    = 50
//   opts.offset       = 0
// The raw triggerPoint before switch-case is (100 - 800) = -700.
// expectedAdjustment is the additional value added by the switch branch.
const PLACEMENT_CASES: Array<[ElementOptions["anchorPlacement"], number]> = [
  ["top-bottom", 0],
  ["bottom-bottom", 50],
  ["top-center", 400],
  ["center-center", 400 + 25],
  ["bottom-center", 400 + 50],
  ["top-top", 800],
  ["bottom-top", 800 + 50],
  ["center-top", 800 + 25],
];

describe("position-calculator", () => {
  it("getElementOffset sums offset chain", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);

    // Fake offsets
    setOffset(parent, 10, 20);
    setOffset(child, 5, 6);

    // Attach parent to body to give child an offsetParent
    document.body.appendChild(parent);

    Object.defineProperty(child, "offsetParent", { value: parent, configurable: true });

    const { top, left } = getElementOffset(child);
    expect(top).toBe(26); // 20 + 6
    expect(left).toBe(15); // 10 + 5
  });

  it("getPositionIn calculates default top-bottom correctly", () => {
    const el = document.createElement("div");
    setOffset(el, 0, 100, 0, 50);
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    const trigger = getPositionIn(el, makeOpts({ offset: 120 }));
    expect(trigger).toBe(100 - 800 + 120);
  });

  it("getPositionIn center-bottom adds half element height", () => {
    const el = document.createElement("div");
    setOffset(el, 0, 100, 0, 50); // height 50
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    const trigger = getPositionIn(el, makeOpts({ offset: 120, anchorPlacement: "center-bottom" }));
    expect(trigger).toBe(100 - 800 + 25 + 120);
  });

  // ---------------------------------------------------------------------
  // Parameterised anchorPlacement variations (covers remaining switch cases)
  // ---------------------------------------------------------------------
  const VARIANTS: Array<[ElementOptions["anchorPlacement"], number]> = [
    ["bottom-bottom", 50],
    ["top-center", 400],
    ["center-center", 400 + 25],
    ["bottom-center", 400 + 50],
    ["top-top", 800],
    ["bottom-top", 800 + 50],
    ["center-top", 800 + 25],
  ];

  VARIANTS.forEach(([placement, adjust]) => {
    it(`getPositionIn handles anchorPlacement '${placement}'`, () => {
      const el = document.createElement("div");
      setOffset(el, 0, 100, 0, 50);
      Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

      const base = 100 - 800; // raw trigger point
      const trigger = getPositionIn(el, makeOpts({ anchorPlacement: placement, offset: 0 }));
      expect(trigger).toBe(base + adjust);
    });
  });

  it("getPositionIn uses opts.anchor element when provided", () => {
    const target = document.createElement("div");
    setOffset(target, 0, 0);

    const ref = document.createElement("div");
    ref.id = "ref-el";
    setOffset(ref, 0, 300, 0, 60);
    document.body.appendChild(ref);

    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    const trigger = getPositionIn(target, makeOpts({ anchor: "#ref-el", offset: 0 }));
    expect(trigger).toBe(300 - 800);

    // cleanup
    ref.remove();
  });

  it("getPositionOut computes using element height and offset", () => {
    const el = document.createElement("div");
    setOffset(el, 0, 100, 0, 50);

    const posOut = getPositionOut(el, makeOpts({ offset: 30 }));
    expect(posOut).toBe(100 + 50 - 30);
  });

  it("isElementAboveViewport detects when element bottom above scrollY", () => {
    const el = document.createElement("div");
    setOffset(el, 0, 100, 0, 50); // bottom = 150

    Object.defineProperty(window, "scrollY", { value: 200, configurable: true });
    expect(isElementAboveViewport(el)).toBe(true);

    Object.defineProperty(window, "scrollY", { value: 120, configurable: true });
    expect(isElementAboveViewport(el)).toBe(false);
  });
});
