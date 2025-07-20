import { describe, expect, it, vi } from "vitest";

import { debounce, throttle } from "../helpers/utils.js";

// -----------------------------------------------------------------------------
// throttle()
// -----------------------------------------------------------------------------

describe("utils – throttle()", () => {
  it("invokes function at most once per delay period", () => {
    const spy = vi.fn();
    const throttled = throttle(spy, 100);

    vi.useFakeTimers();

    // Call multiple times rapidly – should trigger immediately once
    throttled();
    throttled();
    throttled();
    expect(spy).toHaveBeenCalledTimes(1);

    // Advance 99 ms – still within delay window
    vi.advanceTimersByTime(99);
    expect(spy).toHaveBeenCalledTimes(1);

    // Advance 1 ms – queued call should now fire
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

// -----------------------------------------------------------------------------
// debounce()
// -----------------------------------------------------------------------------

describe("utils – debounce()", () => {
  it("invokes function after period of inactivity", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 100);

    vi.useFakeTimers();

    // Rapid calls should delay execution
    debounced();
    debounced();
    debounced();
    expect(spy).not.toHaveBeenCalled();

    // After 100 ms of inactivity it should fire once
    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
