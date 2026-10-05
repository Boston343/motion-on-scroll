import { beforeAll, describe, expect, it } from "vitest";

import { resolveElementOptions } from "../helpers/attributes.js";
import { DATA_PREFIX, DEFAULT_OPTIONS } from "../helpers/constants.js";
import type { PartialMosOptions } from "../helpers/types.js";

// Set up a minimal DOM for dataset/element tests
beforeAll(() => {
  document.body.innerHTML = "";
});

// Helper to construct a fake element with data-* attributes
type DataMap = Record<string, string | undefined>;
function makeElement(dataset: DataMap = {}): HTMLElement {
  const el = document.createElement("div");
  Object.entries(dataset).forEach(([k, v]) => {
    if (v !== undefined) (el.dataset as any)[k] = v;
  });
  return el;
}

// Helper to construct an element from literal HTML attributes
function makeElementWithAttrs(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement("div");
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  return el;
}

describe("resolveElementOptions", () => {
  it("parses numeric dataset attributes", () => {
    const ds: DataMap = {
      [`${DATA_PREFIX}Offset`]: "120",
      [`${DATA_PREFIX}Duration`]: "550",
      [`${DATA_PREFIX}Delay`]: "75",
      [`${DATA_PREFIX}Distance`]: "30",
      [`${DATA_PREFIX}Easing`]: "linear",
    } as any;

    const el = makeElement(ds);
    const opts = resolveElementOptions(el, {});

    expect(opts.offset).toBe(120);
    expect(opts.duration).toBe(550);
    expect(opts.delay).toBe(75);
    expect(opts.distance).toBe(30);
    expect(opts.easing).toBe("linear");
    expect(opts.once).toBe(false);
    expect(opts.disable).toBe(false);
    expect(opts.anchor).toBe(undefined);
    expect(opts.keyframes).toBe("fade");
  });

  it("merges with global options and falls back to defaults", () => {
    const el = makeElement(); // no dataset
    const global: PartialMosOptions = { delay: 200 };

    const opts = resolveElementOptions(el, global);

    // default preset should be "fade"
    expect(opts.keyframes).toBe("fade");
    // comes from global
    expect(opts.delay).toBe(200);
    // fallback to DEFAULT_OPTIONS
    expect(opts.duration).toBe(DEFAULT_OPTIONS.duration);
  });

  it("resolves a bare element to the AOS-compatible defaults", () => {
    const opts = resolveElementOptions(makeElementWithAttrs({ "data-mos": "" }), {});

    expect(opts).toMatchObject({
      keyframes: "fade",
      offset: 120,
      duration: 400,
      delay: 0,
      easing: "ease",
      once: false,
      mirror: false,
      anchorPlacement: "top-bottom",
      timeUnits: "ms",
      initClassName: "mos-init",
      animatedClassName: "mos-animate",
      useClassNames: false,
    });
    expect(opts.id).toBeUndefined();
    expect(opts.anchor).toBeUndefined();
  });

  it("reads the animation name from data-mos", () => {
    const opts = resolveElementOptions(makeElementWithAttrs({ "data-mos": "zoom-in-up" }), {});
    expect(opts.keyframes).toBe("zoom-in-up");
  });

  it("lets element attributes override global options", () => {
    const el = makeElementWithAttrs({
      "data-mos": "fade-up",
      "data-mos-offset": "10",
      "data-mos-duration": "900",
      "data-mos-delay": "0",
      "data-mos-distance": "0",
      "data-mos-easing": "ease-in-out-back",
      "data-mos-anchor": "#trigger",
    });

    const opts = resolveElementOptions(el, {
      offset: 300,
      duration: 100,
      delay: 200,
      distance: 50,
      easing: "linear",
    });

    expect(opts.offset).toBe(10);
    expect(opts.duration).toBe(900);
    // a value of 0 is a real value, not "missing"
    expect(opts.delay).toBe(0);
    expect(opts.distance).toBe(0);
    expect(opts.easing).toBe("ease-in-out-back");
    expect(opts.anchor).toBe("#trigger");
  });

  it("parses negative and fractional numbers", () => {
    const el = makeElementWithAttrs({ "data-mos-offset": "-50", "data-mos-duration": "0.75" });
    const opts = resolveElementOptions(el, {});

    expect(opts.offset).toBe(-50);
    expect(opts.duration).toBe(0.75);
  });

  it("ignores non-numeric values for numeric attributes", () => {
    const el = makeElementWithAttrs({
      "data-mos-offset": "abc",
      "data-mos-duration": "",
      "data-mos-delay": "fast",
    });
    const opts = resolveElementOptions(el, { delay: 200 });

    expect(opts.offset).toBe(DEFAULT_OPTIONS.offset);
    expect(opts.duration).toBe(DEFAULT_OPTIONS.duration);
    expect(opts.delay).toBe(200);
  });

  it("does not mutate the global options object", () => {
    const global: PartialMosOptions = { delay: 200 };
    resolveElementOptions(
      makeElementWithAttrs({ "data-mos-delay": "5", "data-mos-id": "a" }),
      global,
    );

    expect(global).toEqual({ delay: 200 });
  });

  // ===================================================================
  // ID
  // ===================================================================

  describe("empty attributes", () => {
    it("falls back to the global easing for an empty data-mos-easing", () => {
      const el = makeElementWithAttrs({ "data-mos": "fade", "data-mos-easing": "" });
      expect(resolveElementOptions(el, { easing: "linear" }).easing).toBe("linear");
    });

    it("falls back to the default easing for an empty data-mos-easing without a global one", () => {
      const el = makeElementWithAttrs({ "data-mos": "fade", "data-mos-easing": "" });
      expect(resolveElementOptions(el, {}).easing).toBe(DEFAULT_OPTIONS.easing);
    });

    it("still lets a non-empty data-mos-easing override the global easing", () => {
      const el = makeElementWithAttrs({ "data-mos": "fade", "data-mos-easing": "ease-out" });
      expect(resolveElementOptions(el, { easing: "linear" }).easing).toBe("ease-out");
    });

    it("uses the fade preset for an empty data-mos", () => {
      const el = makeElementWithAttrs({ "data-mos": "" });
      expect(resolveElementOptions(el, {}).keyframes).toBe("fade");
    });
  });

  describe("data-mos-id", () => {
    it("reads data-mos-id into options.id", () => {
      const el = makeElementWithAttrs({ "data-mos": "fade", "data-mos-id": "hero" });
      expect(resolveElementOptions(el, {}).id).toBe("hero");
    });

    it("leaves id undefined without the attribute", () => {
      const el = makeElementWithAttrs({ "data-mos": "fade", id: "dom-id" });
      expect(resolveElementOptions(el, {}).id).toBeUndefined();
    });

    it("keeps ids separate per element", () => {
      const global: PartialMosOptions = {};
      const a = resolveElementOptions(makeElementWithAttrs({ "data-mos-id": "a" }), global);
      const b = resolveElementOptions(makeElementWithAttrs({}), global);

      expect(a.id).toBe("a");
      expect(b.id).toBeUndefined();
    });
  });

  // ===================================================================
  // ANCHOR PLACEMENT
  // ===================================================================

  describe("anchorPlacement", () => {
    it("defaults to top-bottom", () => {
      expect(DEFAULT_OPTIONS.anchorPlacement).toBe("top-bottom");
      expect(resolveElementOptions(makeElement(), {}).anchorPlacement).toBe("top-bottom");
    });

    it("uses the global anchorPlacement option", () => {
      const opts = resolveElementOptions(makeElement(), { anchorPlacement: "center-center" });
      expect(opts.anchorPlacement).toBe("center-center");
    });

    it("lets data-mos-anchor-placement override the global option", () => {
      const el = makeElementWithAttrs({ "data-mos-anchor-placement": "bottom-top" });
      const opts = resolveElementOptions(el, { anchorPlacement: "center-center" });
      expect(opts.anchorPlacement).toBe("bottom-top");
    });

    it("lets data-mos-anchor-placement override the default", () => {
      const el = makeElementWithAttrs({ "data-mos-anchor-placement": "top-center" });
      expect(resolveElementOptions(el, {}).anchorPlacement).toBe("top-center");
    });

    it("only overrides the element that carries the attribute", () => {
      const global: PartialMosOptions = { anchorPlacement: "center-bottom" };
      const withAttr = makeElementWithAttrs({ "data-mos-anchor-placement": "top-top" });

      expect(resolveElementOptions(withAttr, global).anchorPlacement).toBe("top-top");
      expect(resolveElementOptions(makeElement(), global).anchorPlacement).toBe("center-bottom");
    });

    it("does not confuse data-mos-anchor with data-mos-anchor-placement", () => {
      const el = makeElementWithAttrs({ "data-mos-anchor": ".target" });
      const opts = resolveElementOptions(el, { anchorPlacement: "bottom-bottom" });

      expect(opts.anchor).toBe(".target");
      expect(opts.anchorPlacement).toBe("bottom-bottom");
    });
  });

  // ===================================================================
  // ONCE / MIRROR
  // ===================================================================

  describe.each(["once", "mirror"] as const)("data-mos-%s", (name) => {
    const attr = `data-${DATA_PREFIX}-${name}`;

    it("handles boolean attribute value true", () => {
      const opts = resolveElementOptions(makeElementWithAttrs({ [attr]: "true" }), {});
      expect(opts[name]).toBe(true);
    });

    it("parses the string false as false", () => {
      const opts = resolveElementOptions(makeElementWithAttrs({ [attr]: "false" }), {});
      expect(opts[name]).toBe(false);
    });

    it("treats the bare attribute as true", () => {
      const opts = resolveElementOptions(makeElementWithAttrs({ [attr]: "" }), {});
      expect(opts[name]).toBe(true);
    });

    it("falls back to the global option without the attribute", () => {
      expect(resolveElementOptions(makeElement(), { [name]: true })[name]).toBe(true);
      expect(resolveElementOptions(makeElement(), { [name]: false })[name]).toBe(false);
      expect(resolveElementOptions(makeElement(), {})[name]).toBe(false);
    });

    it("lets the attribute false override a global true", () => {
      const opts = resolveElementOptions(makeElementWithAttrs({ [attr]: "false" }), {
        [name]: true,
      });
      expect(opts[name]).toBe(false);
    });

    it("lets the attribute true override a global false", () => {
      const opts = resolveElementOptions(makeElementWithAttrs({ [attr]: "true" }), {
        [name]: false,
      });
      expect(opts[name]).toBe(true);
    });

    it("always resolves to a real boolean", () => {
      for (const value of ["true", "false", ""]) {
        const opts = resolveElementOptions(makeElementWithAttrs({ [attr]: value }), {});
        expect(typeof opts[name]).toBe("boolean");
      }
    });
  });

  it("parses once and mirror independently", () => {
    const el = makeElementWithAttrs({ "data-mos-once": "false", "data-mos-mirror": "true" });
    const opts = resolveElementOptions(el, { once: true, mirror: false });

    expect(opts.once).toBe(false);
    expect(opts.mirror).toBe(true);
  });
});
