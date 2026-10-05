import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce, throttle } from "../helpers/utils.js";

beforeEach(() => {
  vi.useFakeTimers();
  // throttle() compares against Date.now(), so start from a realistic timestamp
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// -----------------------------------------------------------------------------
// throttle()
// -----------------------------------------------------------------------------

describe("utils – throttle()", () => {
  it("invokes function at most once per delay period", () => {
    const spy = vi.fn();
    const throttled = throttle(spy, 100);

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

    // Nothing else is queued
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does not schedule a trailing call for a single invocation", () => {
    const spy = vi.fn();
    const throttled = throttle(spy, 100);

    throttled();
    vi.advanceTimersByTime(1000);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("passes arguments through and uses the latest ones for the trailing call", () => {
    const spy = vi.fn();
    const throttled = throttle(spy, 100);

    throttled("a", 1);
    throttled("b", 2);
    throttled("c", 3);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith("a", 1);

    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith("c", 3);
  });

  it("invokes immediately again once the delay has passed", () => {
    const spy = vi.fn();
    const throttled = throttle(spy, 100);

    throttled();
    vi.advanceTimersByTime(101);
    throttled();

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("keeps the call rate bounded during a continuous stream of calls", () => {
    const spy = vi.fn();
    const throttled = throttle(spy, 100);

    // one call every 10 ms for one second
    for (let i = 0; i < 100; i++) {
      throttled();
      vi.advanceTimersByTime(10);
    }

    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(11);
  });

  it("keeps separate state per throttled function", () => {
    const first = vi.fn();
    const second = vi.fn();
    const throttledFirst = throttle(first, 100);
    const throttledSecond = throttle(second, 100);

    throttledFirst();
    throttledSecond();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// debounce()
// -----------------------------------------------------------------------------

describe("utils – debounce()", () => {
  it("invokes function after period of inactivity", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 100);

    // Rapid calls should delay execution
    debounced();
    debounced();
    debounced();
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(spy).not.toHaveBeenCalled();

    // After 100 ms of inactivity it should fire once
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);

    // And only once
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("restarts the waiting period on every call", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 100);

    debounced();
    vi.advanceTimersByTime(80);
    debounced();
    vi.advanceTimersByTime(80);
    debounced();
    vi.advanceTimersByTime(99);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("invokes the function with the arguments of the last call", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 100);

    debounced("a", 1);
    debounced("b", 2);
    vi.advanceTimersByTime(100);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("b", 2);
  });

  it("fires again for a new burst after the previous one completed", () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 100);

    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
