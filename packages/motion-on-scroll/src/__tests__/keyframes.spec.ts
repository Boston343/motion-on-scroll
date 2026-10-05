import { describe, expect, it } from "vitest";

import { KEYFRAMES_PRESETS } from "../helpers/constants.js";
import {
  getKeyframesWithDistance,
  registerKeyframes,
  resolveKeyframes,
} from "../helpers/keyframes.js";
import type { ElementOptions } from "../helpers/types.js";

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

// ===================================================================
// BUILT-IN PRESETS
// ===================================================================

describe("flip presets", () => {
  // AOS: flip-left starts at rotateY(-100deg), flip-right at rotateY(100deg),
  // flip-up at rotateX(-100deg), flip-down at rotateX(100deg), all with perspective(2500px)
  it.each([
    ["flip-left", { transformPerspective: 2500, rotateY: [-100, 0] }],
    ["flip-right", { transformPerspective: 2500, rotateY: [100, 0] }],
    ["flip-up", { transformPerspective: 2500, rotateX: [-100, 0] }],
    ["flip-down", { transformPerspective: 2500, rotateX: [100, 0] }],
  ])("%s matches AOS's rotation and perspective", (name, expected) => {
    expect(resolveKeyframes(name)).toEqual(expected);
    expect(KEYFRAMES_PRESETS[name]).toEqual(expected);
  });

  it.each(["flip-left", "flip-right", "flip-up", "flip-down"])(
    "%s does not fade or use the plain CSS perspective property",
    (name) => {
      const keyframes = resolveKeyframes(name) as Record<string, unknown>;
      expect(keyframes.transformPerspective).toBe(2500);
      expect(keyframes).not.toHaveProperty("perspective");
      expect(keyframes).not.toHaveProperty("opacity");
    },
  );

  it.each([
    ["flip-left", "rotateY", "rotateX"],
    ["flip-right", "rotateY", "rotateX"],
    ["flip-up", "rotateX", "rotateY"],
    ["flip-down", "rotateX", "rotateY"],
  ])("%s rotates around %s only", (name, axis, otherAxis) => {
    const keyframes = resolveKeyframes(name) as Record<string, unknown>;
    expect(keyframes).toHaveProperty(axis);
    expect(keyframes).not.toHaveProperty(otherAxis);
  });

  it("flip presets are not changed by a custom distance", () => {
    for (const name of ["flip-left", "flip-right", "flip-up", "flip-down"]) {
      const resolved = resolveKeyframes(name);
      const opts = { keyframes: name, distance: 30 } as ElementOptions;
      expect(getKeyframesWithDistance(opts, resolved)).toEqual(resolved);
    }
  });
});

describe("built-in presets", () => {
  it("provides every AOS animation name", () => {
    const AOS_ANIMATIONS = [
      "fade",
      "fade-up",
      "fade-down",
      "fade-left",
      "fade-right",
      "fade-up-right",
      "fade-up-left",
      "fade-down-right",
      "fade-down-left",
      "flip-up",
      "flip-down",
      "flip-left",
      "flip-right",
      "slide-up",
      "slide-down",
      "slide-left",
      "slide-right",
      "zoom-in",
      "zoom-in-up",
      "zoom-in-down",
      "zoom-in-left",
      "zoom-in-right",
      "zoom-out",
      "zoom-out-up",
      "zoom-out-down",
      "zoom-out-left",
      "zoom-out-right",
    ];
    expect(Object.keys(KEYFRAMES_PRESETS).sort()).toEqual(AOS_ANIMATIONS.sort());
  });

  it("every preset ends in the element's natural state", () => {
    const NATURAL: Record<string, number> = {
      opacity: 1,
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotateX: 0,
      rotateY: 0,
    };
    for (const [name, keyframes] of Object.entries(KEYFRAMES_PRESETS)) {
      for (const [prop, value] of Object.entries(keyframes as Record<string, unknown>)) {
        if (!Array.isArray(value)) continue;
        expect(value[value.length - 1], `${name} ${prop}`).toBe(NATURAL[prop]);
      }
    }
  });
});
