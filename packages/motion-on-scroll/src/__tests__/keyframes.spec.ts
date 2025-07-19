import { describe, expect, it } from "vitest";

import { KEYFRAMES_PRESETS } from "../helpers/constants.js";
import { registerKeyframes, resolveKeyframes } from "../helpers/keyframes.js";

// Example custom presets
const spinPreset = {
  keyframes: { rotate: [0, 360] },
};

const opacityPreset = {
  keyframes: { opacity: [1, 0] },
};

describe("registerKeyframes / resolveKeyframes", () => {
  it("registers and resolves a custom preset", () => {
    registerKeyframes("spin", spinPreset);
    expect(resolveKeyframes("spin")).toEqual(spinPreset);
  });

  it("overwrites an existing custom preset", () => {
    registerKeyframes("spin", opacityPreset);
    expect(resolveKeyframes("spin")).toEqual(opacityPreset);
  });

  it("ignores custom presets it shouldn't use", () => {
    registerKeyframes("spin", spinPreset);
    expect(resolveKeyframes("fade-up")).toEqual(KEYFRAMES_PRESETS["fade-up"]);
  });

  it("throws error when not given a name for custom keyframes", () => {
    expect(() => registerKeyframes("", spinPreset)).toThrowError();
    expect(() => registerKeyframes("  ", spinPreset)).toThrowError();
  });

  it("falls back to built-in preset when custom not found", () => {
    expect(resolveKeyframes("fade-up")).toEqual(KEYFRAMES_PRESETS["fade-up"]);
  });

  it("falls back to default 'fade' when preset name is unknown", () => {
    expect(resolveKeyframes("totally-unknown")).toEqual(KEYFRAMES_PRESETS.fade);
  });
});
