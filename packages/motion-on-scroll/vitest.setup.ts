// Global test setup for Vitest
// Provide a global mock for the "motion" package so that helper functions that
// rely on AnimationPlaybackControls don't error in unit tests. Individual test
// files can still override/extend this mock as needed.
import { vi } from "vitest";

type Controls = {
  play: () => void;
  pause: () => void;
  stop: () => void;
  cancel: () => void;
  complete: () => void;
  finished: Promise<void>;
  speed: number;
  time: number;
};

vi.mock("motion", () => {
  return {
    animate: vi.fn((el: any, keyframes: any, opts: any): Controls => {
      return {
        play: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
        cancel: vi.fn(),
        complete: vi.fn(),
        finished: Promise.resolve(),
        speed: 1,
        time: 0,
      } as Controls;
    }),
    spring: vi.fn((opts: any) => ({ ...opts, _spring: true })),
  };
});
