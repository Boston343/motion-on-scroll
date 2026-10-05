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

  // ===================================================================
  // KEYWORDS
  // ===================================================================

  it("resolves ease to the CSS ease curve (as AOS does)", () => {
    expect(resolveEasing("ease")).toEqual([0.25, 0.1, 0.25, 1]);
  });

  it.each([
    ["linear", "linear"],
    ["ease-in", "easeIn"],
    ["ease-out", "easeOut"],
    ["ease-in-out", "easeInOut"],
  ])("maps %s to motion's %s", (keyword, expected) => {
    expect(resolveEasing(keyword)).toBe(expected);
  });

  it.each([
    ["ease-in-back", [0.6, -0.28, 0.735, 0.045]],
    ["ease-out-back", [0.175, 0.885, 0.32, 1.275]],
    ["ease-in-out-back", [0.68, -0.55, 0.265, 1.55]],
    ["ease-in-sine", [0.47, 0, 0.745, 0.715]],
    ["ease-out-sine", [0.39, 0.575, 0.565, 1]],
    ["ease-in-out-sine", [0.445, 0.05, 0.55, 0.95]],
  ])("resolves AOS keyword %s to its AOS curve", (keyword, expected) => {
    expect(resolveEasing(keyword)).toEqual(expected);
  });

  it.each(["quad", "cubic", "quart"])("resolves the %s family to AOS's shared curves", (family) => {
    expect(resolveEasing(`ease-in-${family}`)).toEqual([0.55, 0.085, 0.68, 0.53]);
    expect(resolveEasing(`ease-out-${family}`)).toEqual([0.25, 0.46, 0.45, 0.94]);
    expect(resolveEasing(`ease-in-out-${family}`)).toEqual([0.455, 0.03, 0.515, 0.955]);
  });

  it("trims surrounding whitespace before looking up a keyword", () => {
    expect(resolveEasing(" ease ")).toEqual([0.25, 0.1, 0.25, 1]);
    expect(resolveEasing("\tlinear\n")).toBe("linear");
    expect(resolveEasing("  ease-in-out-back")).toEqual([0.68, -0.55, 0.265, 1.55]);
  });

  it("trims surrounding whitespace before looking up a custom easing", () => {
    registerEasing("easing-spec-trimmed", [0.1, 0.2, 0.3, 0.4]);
    expect(resolveEasing("  easing-spec-trimmed  ")).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("does not ignore whitespace inside a keyword", () => {
    expect(resolveEasing("ease in")).toBeNull();
    expect(resolveEasing("ease- in")).toBeNull();
  });

  it("does not treat inherited object properties as keywords", () => {
    expect(resolveEasing("toString")).toBeNull();
    expect(resolveEasing("constructor")).toBeNull();
    expect(resolveEasing("__proto__")).toBeNull();
  });

  it("returns undefined for a missing easing", () => {
    expect(resolveEasing(undefined)).toBeUndefined();
    expect(resolveEasing(null)).toBeUndefined();
  });

  // ===================================================================
  // CUBIC-BEZIER STRINGS
  // ===================================================================

  it("converts cubic-bezier() string to number array", () => {
    expect(arr(resolveEasing("cubic-bezier(.17,.67,.83,.67)"))).toEqual([0.17, 0.67, 0.83, 0.67]);
  });

  it("accepts negative and >1 control points in cubic-bezier() strings", () => {
    expect(resolveEasing("cubic-bezier(0.68, -0.55, 0.265, 1.55)")).toEqual([
      0.68, -0.55, 0.265, 1.55,
    ]);
    expect(resolveEasing("cubic-bezier(.6,-.28,.735,.045)")).toEqual([0.6, -0.28, 0.735, 0.045]);
    expect(resolveEasing("cubic-bezier(0.175,0.885,0.32,1.275)")).toEqual([
      0.175, 0.885, 0.32, 1.275,
    ]);
    expect(resolveEasing("cubic-bezier(0, -2, 1, 3)")).toEqual([0, -2, 1, 3]);
  });

  it("tolerates whitespace in cubic-bezier() strings", () => {
    expect(resolveEasing("  cubic-bezier( 0.68 , -0.55 , 0.265 , 1.55 )  ")).toEqual([
      0.68, -0.55, 0.265, 1.55,
    ]);
  });

  it("accepts integer control points", () => {
    expect(resolveEasing("cubic-bezier(0,0,1,1)")).toEqual([0, 0, 1, 1]);
  });

  // ===================================================================
  // ARRAY STRINGS
  // ===================================================================

  it("converts array-style string to number array", () => {
    expect(arr(resolveEasing("[.17,.67,.83,.67]"))).toEqual([0.17, 0.67, 0.83, 0.67]);
    expect(arr(resolveEasing(".17,.67,.83,.67"))).toEqual([0.17, 0.67, 0.83, 0.67]);
  });

  it("accepts negative and >1 control points in bracketed arrays", () => {
    expect(resolveEasing("[.68,-.55,.265,1.55]")).toEqual([0.68, -0.55, 0.265, 1.55]);
    expect(resolveEasing("[0.68, -0.55, 0.265, 1.55]")).toEqual([0.68, -0.55, 0.265, 1.55]);
    expect(resolveEasing("[ 0.6 , -0.28 , 0.735 , 0.045 ]")).toEqual([0.6, -0.28, 0.735, 0.045]);
  });

  it("accepts negative and >1 control points in bare arrays", () => {
    expect(resolveEasing(".68,-.55,.265,1.55")).toEqual([0.68, -0.55, 0.265, 1.55]);
    expect(resolveEasing("0.175, 0.885, 0.32, 1.275")).toEqual([0.175, 0.885, 0.32, 1.275]);
    expect(resolveEasing("-1,0,0,1")).toEqual([-1, 0, 0, 1]);
    expect(resolveEasing("0,-2,1,3")).toEqual([0, -2, 1, 3]);
  });

  // ===================================================================
  // INVALID INPUT
  // ===================================================================

  it("returns null for invalid input", () => {
    expect(resolveEasing("ease-in-quartf")).toBeNull();
    expect(resolveEasing("[.17,.67,.83]")).toBeNull();
    expect(resolveEasing("[.17,.67,.83,.67,.67]")).toBeNull();
  });

  it.each([
    "cubic-bezier(1,2,3)",
    "cubic-bezier(1,2,3,4,5)",
    "cubic-bezier()",
    "cubic-bezier(a,b,c,d)",
    "cubic-bezier(0.1 0.2 0.3 0.4)",
    "cubic-bezier(--1,0,0,1)",
    "cubic-bezier(0,0,1,-)",
    "cubic-bezier(0,0,1,1",
    "1,2,3",
    "1,2,3,4,5",
    "--1,0,0,1",
    "1,-,0,1",
    "1,,0,1",
    "1,2,3,",
    "-,-,-,-",
    "1.2.3,0,0,1",
    "abc",
    "a,b,c,d",
    "[]",
    "",
    "   ",
  ])("rejects %j", (input) => {
    expect(resolveEasing(input)).toBeNull();
  });

  // The cubic-bezier pattern is anchored, like the array pattern
  it.each(["cubic-bezier(0,0,1,1) and more", "notcubic-bezier(0,0,1,1)"])(
    "rejects %j (cubic-bezier surrounded by garbage)",
    (input) => {
      expect(resolveEasing(input)).toBeNull();
    },
  );
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

  it("registers a cubic-bezier string with negative and >1 control points", () => {
    registerEasing("overshoot", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
    expect(resolveEasing("overshoot")).toEqual([0.68, -0.55, 0.265, 1.55]);
  });

  it("registers an array string with negative and >1 control points", () => {
    registerEasing("overshoot-array", "[.68,-.55,.265,1.55]");
    expect(resolveEasing("overshoot-array")).toEqual([0.68, -0.55, 0.265, 1.55]);
  });

  it("registers a keyword string by resolving it", () => {
    registerEasing("my-ease", "ease");
    registerEasing("my-out", "ease-out");
    expect(resolveEasing("my-ease")).toEqual([0.25, 0.1, 0.25, 1]);
    expect(resolveEasing("my-out")).toBe("easeOut");
  });

  it("registers a function easing as-is", () => {
    const fn = (t: number) => t * t;
    registerEasing("squared", fn);
    expect(resolveEasing("squared")).toBe(fn);
  });

  it("lets a custom easing take precedence over a built-in keyword", () => {
    registerEasing("ease-in-out-sine", [0.1, 0.2, 0.3, 0.4]);
    expect(resolveEasing("ease-in-out-sine")).toEqual([0.1, 0.2, 0.3, 0.4]);
    // restore the built-in curve for other tests in this file
    registerEasing("ease-in-out-sine", [0.445, 0.05, 0.55, 0.95]);
  });

  it("overwrites a previously registered easing", () => {
    registerEasing("replaceable", [0, 0, 1, 1]);
    registerEasing("replaceable", "cubic-bezier(0.1, -0.2, 0.3, 1.4)");
    expect(resolveEasing("replaceable")).toEqual([0.1, -0.2, 0.3, 1.4]);
  });

  it.each(["cubic-bezier(1,2,3)", "1,2,3", "--1,0,0,1", "abc"])(
    "throws for invalid string definition %j and registers nothing",
    (definition) => {
      expect(() => registerEasing("broken", definition)).toThrowError(/invalid easing/i);
      expect(resolveEasing("broken")).toBeNull();
    },
  );

  it("throws error when not given a name for custom easing", () => {
    expect(() => registerEasing("", [0.68, -0.55, 0.265, 1.55])).toThrowError();
    expect(() => registerEasing("  ", [0.68, -0.55, 0.265, 1.55])).toThrowError();
  });
});
