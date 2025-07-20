// Global test setup for Vitest
// Ensures a JSDOM window is available for all tests
import { JSDOM } from "jsdom";

if (typeof window === "undefined") {
  const { window } = new JSDOM("<html><body></body></html>");
  // @ts-expect-error attach globals for jsdom
  global.window = window;
  global.document = window.document;
  global.HTMLElement = window.HTMLElement;
}

// Provide a global mock for the "motion" package so that helper functions that
// rely on AnimationPlaybackControls don't error in unit tests. Individual test
// files can still override/extend this mock as needed.
import { vi } from "vitest";

type Controls = {
  play: () => void;
  pause: () => void;
  stop: () => void;
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
        complete: vi.fn(),
        finished: Promise.resolve(),
        speed: 1,
        time: 0,
      } as Controls;
    }),
    spring: vi.fn((opts: any) => ({ ...opts, _spring: true })),
  };
});
