import { JSDOM } from "jsdom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Reset modules between tests so module-level state (initialized / globalOptions)
// starts fresh each time.
const freshIndex = async () => {
  vi.resetModules();
  // re-apply mocks after reset so fresh modules get spied versions
  vi.doMock("../helpers/observer", () => ({
    observeElement: vi.fn(),
  }));
  vi.doMock("../helpers/attributes", () => ({
    resolveElementOptions: vi.fn(() => ({ dummy: true })),
  }));
  vi.doMock("../helpers/utils", () => ({
    isDisabled: vi.fn(() => false),
    removeMosAttributes: vi.fn(),
  }));
  return await import("../index.js");
};

// Note: test cases will import the mocked modules AFTER calling freshIndex() to
// ensure they reference the same spy instances created by the mocks above.

beforeAll(() => {
  const { window } = new JSDOM("<html><body></body></html>");
  (global as any).window = window;
  (global as any).document = window.document;
  (global as any).HTMLElement = window.HTMLElement;
});

beforeEach(() => {
  document.body.innerHTML = ""; // cleanup DOM
  vi.clearAllMocks();
});

describe("index.init()", () => {
  it("observes each data-mos element on first init", async () => {
    document.body.innerHTML = '<div data-mos="fade"></div><div data-mos="slide-up"></div>';

    const { MOS } = await freshIndex();
    const observer = await import("../helpers/observer.js");
    const attrs = await import("../helpers/attributes.js");
    MOS.init({ delay: 100 } as any);

    expect(observer.observeElement).toHaveBeenCalledTimes(2);
    expect(attrs.resolveElementOptions).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ delay: 100 }),
    );
  });

  it("short-circuits when globally disabled and strips attributes", async () => {
    const { MOS } = await freshIndex();
    const utils = await import("../helpers/utils.js");
    const observer = await import("../helpers/observer.js");
    (utils.isDisabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    document.body.innerHTML = '<div data-mos="fade" data-mos-delay="50"></div>';

    MOS.init();

    expect(observer.observeElement).not.toHaveBeenCalled();
    expect(utils.removeMosAttributes).toHaveBeenCalledTimes(1);
  });

  it("scales default duration and delay when timeUnits is 's'", async () => {
    const { MOS } = await freshIndex();
    const attrs = await import("../helpers/attributes.js");
    document.body.innerHTML = '<div data-mos="fade"></div>';

    MOS.init({ timeUnits: "s" } as any);

    expect(attrs.resolveElementOptions).toHaveBeenCalledTimes(1);
    expect(attrs.resolveElementOptions).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ duration: 0.4, delay: 0 }),
    );
  });

  it("honors explicit duration/delay when timeUnits is 's'", async () => {
    const { MOS } = await freshIndex();
    const attrs = await import("../helpers/attributes.js");
    document.body.innerHTML = '<div data-mos="fade"></div>';

    MOS.init({ timeUnits: "s", duration: 2, delay: 1 } as any);

    expect(attrs.resolveElementOptions).toHaveBeenCalledTimes(1);
    expect(attrs.resolveElementOptions).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ duration: 2, delay: 1 }),
    );
  });

  it("merges options and re-observes on subsequent init calls", async () => {
    const { MOS } = await freshIndex();
    const attrs = await import("../helpers/attributes.js");
    document.body.innerHTML = '<div data-mos="fade"></div>';

    MOS.init({ duration: 400 } as any);
    MOS.init({ delay: 200 } as any);

    expect(attrs.resolveElementOptions).toHaveBeenCalledTimes(2);
    expect(attrs.resolveElementOptions).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ delay: 200, duration: 400 }),
    );
  });

  it("auto-refreshes when DOM mutates via MutationObserver", async () => {
    // Provide a fake MutationObserver to capture callback
    let cb!: MutationCallback;
    class FakeMO {
      constructor(c: MutationCallback) {
        cb = c;
      }
      observe() {}
      disconnect() {}
    }
    (global as any).MutationObserver = FakeMO as any;

    const { MOS } = await freshIndex();
    const observer = await import("../helpers/observer.js");

    document.body.innerHTML = '<div data-mos="fade"></div>';
    MOS.init();
    vi.clearAllMocks();

    // Add a new element after init
    const newEl = document.createElement("div");
    newEl.setAttribute("data-mos", "slide-up");
    document.body.appendChild(newEl);

    // Simulate mutation event
    cb([], {} as any);

    expect(observer.observeElement).toHaveBeenCalledTimes(1);
  });

  it("does not start MutationObserver when disableMutationObserver is true", async () => {
    let instanced = false;
    class FakeMO2 {
      constructor() {
        instanced = true;
      }
      observe() {}
      disconnect() {}
    }
    (global as any).MutationObserver = FakeMO2 as any;

    const { MOS } = await freshIndex();
    MOS.init({ disableMutationObserver: true } as any);

    expect(instanced).toBe(false);
  });

  it("bootstraps immediately if DOMContentLoaded already fired", async () => {
    // JSDOM default readyState is "complete" so this scenario is naturally true
    document.body.innerHTML = '<div data-mos="fade"></div>';
    const { MOS } = await freshIndex();
    const observer = await import("../helpers/observer.js");

    MOS.init();

    expect(observer.observeElement).toHaveBeenCalledTimes(1);
  });

  it("waits for and responds to a custom startEvent", async () => {
    document.body.innerHTML = '<div data-mos="fade"></div>';
    // Ensure document.readyState is loading so immediate bootstrap doesn't occur
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true });

    const { MOS } = await freshIndex();
    const observer = await import("../helpers/observer.js");

    MOS.init({ startEvent: "mycustom" } as any);

    // Not yet started
    expect(observer.observeElement).not.toHaveBeenCalled();

    // Dispatch custom event (use JSDOM's Event constructor)
    const CustomEvt = (global as any).window.Event;
    document.dispatchEvent(new CustomEvt("mycustom"));

    expect(observer.observeElement).toHaveBeenCalledTimes(1);
  });

  it("refreshHard strips attributes when disabled", async () => {
    document.body.innerHTML = '<div data-mos="fade" data-mos-delay="50"></div>';

    const { MOS } = await freshIndex();
    const utils = await import("../helpers/utils.js");
    const observer = await import("../helpers/observer.js");

    MOS.init();

    // Simulate disabled state
    (utils.isDisabled as ReturnType<typeof vi.fn>).mockReturnValue(true);
    MOS.refreshHard();

    expect(utils.removeMosAttributes).toHaveBeenCalledTimes(1);
    expect(observer.observeElement).not.toHaveBeenCalled();
  });

  it("bootstraps on window 'load' event when not already complete", async () => {
    // Set DOM to loading state
    Object.defineProperty(document, "readyState", { value: "loading", configurable: true });
    document.body.innerHTML = '<div data-mos="fade"></div>';

    const { MOS } = await freshIndex();
    const observer = await import("../helpers/observer.js");

    MOS.init({ startEvent: "load" } as any);

    // Not yet started
    expect(observer.observeElement).not.toHaveBeenCalled();

    // Dispatch load on window
    const CustomEvt = (global as any).window.Event;
    (global as any).window.dispatchEvent(new CustomEvt("load"));

    expect(observer.observeElement).toHaveBeenCalledTimes(1);
  });
});
