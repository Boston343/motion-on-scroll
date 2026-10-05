import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import utils, { isDisabled, prefersReducedMotion, removeMosAttributes } from "../helpers/utils.js";

describe("utils – isDisabled()", () => {
  // create shared DOM once so window is defined for width checks
  document.body.innerHTML = "";

  const setViewport = (width: number) => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
  };

  beforeEach(() => {
    setViewport(1024);
  });

  it("returns the boolean as-is", () => {
    expect(isDisabled(true)).toBe(true);
    expect(isDisabled(false)).toBe(false);
  });

  it("evaluates device strings based on viewport width", () => {
    setViewport(500); // phone
    expect(isDisabled("phone")).toBe(true);
    expect(isDisabled("tablet")).toBe(false);
    expect(isDisabled("mobile")).toBe(true);

    setViewport(800); // tablet range
    expect(isDisabled("phone")).toBe(false);
    expect(isDisabled("tablet")).toBe(true);
    expect(isDisabled("mobile")).toBe(true);

    setViewport(1200); // desktop
    expect(isDisabled("phone")).toBe(false);
    expect(isDisabled("tablet")).toBe(false);
    expect(isDisabled("mobile")).toBe(false);
  });

  it("uses 768 and 1024 as the device breakpoints", () => {
    setViewport(767);
    expect(isDisabled("phone")).toBe(true);
    expect(isDisabled("tablet")).toBe(false);

    setViewport(768);
    expect(isDisabled("phone")).toBe(false);
    expect(isDisabled("tablet")).toBe(true);

    setViewport(1023);
    expect(isDisabled("tablet")).toBe(true);
    expect(isDisabled("mobile")).toBe(true);

    setViewport(1024);
    expect(isDisabled("tablet")).toBe(false);
    expect(isDisabled("mobile")).toBe(false);
  });

  it("returns false for an unknown keyword", () => {
    setViewport(300);
    expect(isDisabled("desktop" as any)).toBe(false);
  });

  it("executes callback and coerces to boolean", () => {
    expect(isDisabled(() => 1 < 2)).toBe(true);
    expect(isDisabled(() => false)).toBe(false);
    expect(isDisabled((() => "yes") as any)).toBe(true);
    expect(isDisabled((() => 0) as any)).toBe(false);
    expect(isDisabled((() => undefined) as any)).toBe(false);
  });

  it("calls the callback on every evaluation", () => {
    const fn = vi.fn(() => true);

    isDisabled(fn);
    isDisabled(fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("treats a throwing callback as not disabled", () => {
    const fn = () => {
      throw new Error("boom");
    };

    expect(() => isDisabled(fn)).not.toThrow();
    expect(isDisabled(fn)).toBe(false);
  });
});

describe("utils – prefersReducedMotion()", () => {
  const stubMatchMedia = (matches: boolean) => {
    const matchMedia = vi.fn((query: string) => ({ matches, media: query }));
    (window as any).matchMedia = matchMedia;
    return matchMedia;
  };

  afterEach(() => {
    delete (window as any).matchMedia;
  });

  it("returns false when window.matchMedia is not available", () => {
    expect((window as any).matchMedia).toBeUndefined();

    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns false when window.matchMedia is not a function", () => {
    (window as any).matchMedia = null;

    expect(() => prefersReducedMotion()).not.toThrow();
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns true when the reduced motion media query matches", () => {
    const matchMedia = stubMatchMedia(true);

    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledTimes(1);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("returns false when the reduced motion media query does not match", () => {
    const matchMedia = stubMatchMedia(false);

    expect(prefersReducedMotion()).toBe(false);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("reads the preference again on every call", () => {
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);

    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe("utils – removeMosAttributes()", () => {
  it("strips all data-mos* attributes", () => {
    const el = document.createElement("div");
    el.setAttribute("data-mos", "fade");
    el.setAttribute("data-mos-delay", "100");
    el.setAttribute("data-mos-id", "hero");
    el.setAttribute("data-mos-anchor-placement", "top-center");
    el.setAttribute("data-mos-once", "");
    el.setAttribute("data-other", "keep");
    el.setAttribute("data-aos", "fade");
    el.id = "keep-id";
    el.className = "keep-class";

    removeMosAttributes(el);

    expect(Array.from(el.attributes).map((attribute) => attribute.name)).toEqual([
      "data-other",
      "data-aos",
      "id",
      "class",
    ]);
    expect(el.getAttribute("data-other")).toBe("keep");
    expect(el.id).toBe("keep-id");
    expect(el.className).toBe("keep-class");
  });

  it("only touches the given element, not its children", () => {
    const parent = document.createElement("div");
    parent.setAttribute("data-mos", "fade");
    const child = document.createElement("span");
    child.setAttribute("data-mos", "zoom-in");
    parent.appendChild(child);

    removeMosAttributes(parent);

    expect(parent.hasAttribute("data-mos")).toBe(false);
    expect(child.getAttribute("data-mos")).toBe("zoom-in");
  });

  it("does nothing for an element without data-mos attributes", () => {
    const el = document.createElement("div");
    el.setAttribute("data-other", "keep");

    expect(() => removeMosAttributes(el)).not.toThrow();
    expect(el.getAttribute("data-other")).toBe("keep");
  });
});

describe("utils – default export", () => {
  it("exposes every helper", () => {
    expect(utils.isDisabled).toBe(isDisabled);
    expect(utils.prefersReducedMotion).toBe(prefersReducedMotion);
    expect(utils.removeMosAttributes).toBe(removeMosAttributes);
    expect(typeof utils.debounce).toBe("function");
    expect(typeof utils.throttle).toBe("function");
  });
});
