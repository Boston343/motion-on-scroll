import { describe, expect, it } from "vitest";

import { EASINGS } from "../helpers/constants.js";
import { registerEasing, resolveEasing } from "../helpers/easing.js";

// Helper to compare arrays
const arr = (v: unknown) => (Array.isArray(v) ? v.map(Number) : v);

describe("resolveEasing", () => {
  it.each(Object.keys(EASINGS))("resolves keyword %s correctly", (key) => {
    const expected = EASINGS[key as keyof typeof EASINGS];
    expect(arr(resolveEasing(key))).toEqual(arr(expected));
  });

  it("converts cubic-bezier() string to number array", () => {
    expect(arr(resolveEasing("cubic-bezier(.17,.67,.83,.67)"))).toEqual([0.17, 0.67, 0.83, 0.67]);
  });

  it("converts array-style string to number array", () => {
    expect(arr(resolveEasing("[.17,.67,.83,.67]"))).toEqual([0.17, 0.67, 0.83, 0.67]);
    expect(arr(resolveEasing(".17,.67,.83,.67"))).toEqual([0.17, 0.67, 0.83, 0.67]);
  });

  it("returns null for invalid input", () => {
    expect(resolveEasing("ease-in-quartf")).toBeNull();
    expect(resolveEasing("[.17,.67,.83]")).toBeNull();
    expect(resolveEasing("[.17,.67,.83,.67,.67]")).toBeNull();
  });
});

describe("registerEasing", () => {
  it("registers and resolves custom array easing (bouncy)", () => {
    registerEasing("bouncy", [0.68, -0.55, 0.265, 1.55]);
    expect(arr(resolveEasing("bouncy"))).toEqual([0.68, -0.55, 0.265, 1.55]);
  });

  it("registers and resolves cubic-bezier string easing (dramatic)", () => {
    registerEasing("dramatic", "cubic-bezier(0.25, 0.46, 0.45, 0.94)");
    expect(arr(resolveEasing("dramatic"))).toEqual([0.25, 0.46, 0.45, 0.94]);
  });

  it("throws error when not given a name for custom easing", () => {
    expect(() => registerEasing("", [0.68, -0.55, 0.265, 1.55])).toThrowError();
    expect(() => registerEasing("  ", [0.68, -0.55, 0.265, 1.55])).toThrowError();
  });
});
