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
  document.body.innerHTML = '<div id="app"></div>';
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

  // ---------------------------------------------------------------------
  // AOS quirk: an inline anchor placement drops the global offset on the way in
  // ---------------------------------------------------------------------
  describe("getPositionIn offset with an inline anchor placement (AOS parity)", () => {
    function makeEl(attrs: Record<string, string> = {}): HTMLElement {
      const el = document.createElement("div");
      Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
      setOffset(el, 0, 1000, 0, 50);
      Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
      return el;
    }

    it("uses the global offset when the element has no inline placement", () => {
      const el = makeEl();
      expect(getPositionIn(el, makeOpts({ offset: 120 }))).toBe(1000 - 800 + 120);
    });

    it("uses the global offset for a placement that only comes from the global options", () => {
      const el = makeEl();
      const trigger = getPositionIn(el, makeOpts({ offset: 120, anchorPlacement: "top-center" }));
      expect(trigger).toBe(1000 - 800 + 400 + 120);
    });

    it("uses an offset of 0 with an inline placement and no inline offset", () => {
      const el = makeEl({ "data-mos-anchor-placement": "top-center" });
      const trigger = getPositionIn(el, makeOpts({ offset: 120, anchorPlacement: "top-center" }));
      expect(trigger).toBe(1000 - 800 + 400);
    });

    it("drops the offset even when the inline placement equals the default placement", () => {
      const el = makeEl({ "data-mos-anchor-placement": "top-bottom" });
      const trigger = getPositionIn(el, makeOpts({ offset: 120, anchorPlacement: "top-bottom" }));
      expect(trigger).toBe(1000 - 800);
    });

    it("uses the inline offset when both inline placement and inline offset are present", () => {
      const el = makeEl({ "data-mos-anchor-placement": "center-bottom", "data-mos-offset": "75" });
      const trigger = getPositionIn(el, makeOpts({ offset: 75, anchorPlacement: "center-bottom" }));
      expect(trigger).toBe(1000 - 800 + 25 + 75);
    });

    it("uses an inline offset of 0 as given", () => {
      const el = makeEl({ "data-mos-anchor-placement": "top-center", "data-mos-offset": "0" });
      const trigger = getPositionIn(el, makeOpts({ offset: 0, anchorPlacement: "top-center" }));
      expect(trigger).toBe(1000 - 800 + 400);
    });

    it("uses an inline offset without an inline placement", () => {
      const el = makeEl({ "data-mos-offset": "75" });
      expect(getPositionIn(el, makeOpts({ offset: 75 }))).toBe(1000 - 800 + 75);
    });

    it("looks at the element's own attributes, not at those of its anchor", () => {
      const anchor = document.createElement("div");
      anchor.id = "quirk-anchor";
      anchor.setAttribute("data-mos-anchor-placement", "top-center");
      setOffset(anchor, 0, 3000, 0, 60);
      document.body.appendChild(anchor);

      const el = makeEl();
      const trigger = getPositionIn(el, makeOpts({ anchor: "#quirk-anchor", offset: 120 }));
      expect(trigger).toBe(3000 - 800 + 120);

      const withPlacement = makeEl({ "data-mos-anchor-placement": "bottom-bottom" });
      const quirked = getPositionIn(
        withPlacement,
        makeOpts({ anchor: "#quirk-anchor", offset: 120, anchorPlacement: "bottom-bottom" }),
      );
      expect(quirked).toBe(3000 - 800 + 60);

      anchor.remove();
    });

    it("does not affect getPositionOut, which always applies the offset", () => {
      const el = makeEl({ "data-mos-anchor-placement": "top-center" });
      const out = getPositionOut(el, makeOpts({ offset: 120, anchorPlacement: "top-center" }));
      expect(out).toBe(1000 + 50 - 120);
    });
  });

  it("getPositionOut computes using element height and offset", () => {
    const el = document.createElement("div");
    setOffset(el, 0, 100, 0, 50);

    const posOut = getPositionOut(el, makeOpts({ offset: 30 }));
    expect(posOut).toBe(100 + 50 - 30);
  });

  it("getPositionIn falls back to the element itself when the anchor selector matches nothing", () => {
    const el = document.createElement("div");
    setOffset(el, 0, 100, 0, 50);
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    const trigger = getPositionIn(el, makeOpts({ anchor: "#does-not-exist", offset: 0 }));
    expect(trigger).toBe(100 - 800);
  });

  it("getPositionIn applies anchorPlacement using the anchor element's height", () => {
    const target = document.createElement("div");
    setOffset(target, 0, 0, 0, 10);

    const ref = document.createElement("div");
    ref.id = "ref-el";
    setOffset(ref, 0, 300, 0, 60);
    document.body.appendChild(ref);

    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    const trigger = getPositionIn(
      target,
      makeOpts({ anchor: "#ref-el", anchorPlacement: "bottom-bottom", offset: 20 }),
    );
    expect(trigger).toBe(300 - 800 + 60 + 20);

    // cleanup
    ref.remove();
  });

  it("getPositionIn includes the offsets of the element's offsetParent chain", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);
    setOffset(parent, 0, 1000);
    setOffset(child, 0, 250, 0, 50);
    Object.defineProperty(child, "offsetParent", { value: parent, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });

    expect(getPositionIn(child, makeOpts({ offset: 120 }))).toBe(1250 - 800 + 120);
    expect(getPositionOut(child, makeOpts({ offset: 120 }))).toBe(1250 + 50 - 120);
  });

  it("getElementOffset subtracts the scroll position of scrollable ancestors", () => {
    const scroller = document.createElement("div");
    const child = document.createElement("div");
    scroller.appendChild(child);
    setOffset(scroller, 0, 100);
    setOffset(child, 0, 500);
    Object.defineProperty(child, "offsetParent", { value: scroller, configurable: true });
    scroller.scrollTop = 0;
    Object.defineProperty(scroller, "scrollTop", { value: 200, configurable: true });

    expect(getElementOffset(child).top).toBe(100 + 500 - 200);
  });

  it("getPositionOut uses opts.anchor element when provided", () => {
    const target = document.createElement("div");
    setOffset(target, 0, 0, 0, 10);

    const ref = document.createElement("div");
    ref.id = "ref-el";
    setOffset(ref, 0, 300, 0, 60);
    document.body.appendChild(ref);

    expect(getPositionOut(target, makeOpts({ anchor: "#ref-el", offset: 30 }))).toBe(300 + 60 - 30);

    // cleanup
    ref.remove();
  });

  it("getPositionOut falls back to the element itself when the anchor selector matches nothing", () => {
    const el = document.createElement("div");
    setOffset(el, 0, 100, 0, 50);

    expect(getPositionOut(el, makeOpts({ anchor: "#does-not-exist", offset: 30 }))).toBe(120);
  });

  it("isElementAboveViewport is false while the element's bottom edge is at or below scrollY", () => {
    const el = document.createElement("div");
    setOffset(el, 0, 100, 0, 50); // bottom = 150

    Object.defineProperty(window, "scrollY", { value: 150, configurable: true });
    expect(isElementAboveViewport(el)).toBe(false);

    Object.defineProperty(window, "scrollY", { value: 151, configurable: true });
    expect(isElementAboveViewport(el)).toBe(true);
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
