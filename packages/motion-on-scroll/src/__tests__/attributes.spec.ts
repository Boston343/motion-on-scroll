import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

import { resolveElementOptions } from "../helpers/attributes.js";
import { DATA_PREFIX, DEFAULT_OPTIONS } from "../helpers/constants.js";
import type { PartialMosOptions } from "../helpers/types.js";

// Set up a minimal DOM for dataset/element tests
beforeAll(() => {
  const { window } = new JSDOM("<html><body></body></html>");
  (global as any).window = window;
  (global as any).document = window.document;
  (global as any).HTMLElement = window.HTMLElement;
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
    expect(opts.anchorPlacement).toBe(undefined);
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

  it("handles boolean once attribute", () => {
    const el = makeElement();
    el.setAttribute(`data-${DATA_PREFIX}-once`, "true");
    const opts = resolveElementOptions(el, {});
    expect(opts.once).toBe(true);
  });
});
