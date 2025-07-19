import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";

import { isDisabled, removeMosAttributes } from "../helpers/utils.js";

describe("utils – isDisabled()", () => {
  // create shared DOM once so window is defined for width checks
  const { window } = new JSDOM("<html><body></body></html>");
  (global as any).window = window;
  (global as any).document = window.document;

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
    expect(isDisabled("mobile")).toBe(false);
  });

  it("executes callback and coerces to boolean", () => {
    const fn = () => 1 < 2;
    expect(isDisabled(fn)).toBe(true);
  });
});

describe("utils – removeMosAttributes()", () => {
  it("strips all data-mos* attributes", () => {
    const el = document.createElement("div");
    el.setAttribute("data-mos", "fade");
    el.setAttribute("data-mos-delay", "100");
    el.setAttribute("data-other", "keep");

    removeMosAttributes(el);

    expect(el.hasAttribute("data-mos")).toBe(false);
    expect(el.hasAttribute("data-mos-delay")).toBe(false);
    expect(el.getAttribute("data-other")).toBe("keep");
  });
});
