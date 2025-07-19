import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Utility to import a fresh copy of index.ts with mocks applied
const freshIndex = async () => {
  vi.resetModules();
  vi.doMock("../helpers/observer", () => ({ observeElement: vi.fn() }));
  vi.doMock("../helpers/attributes", () => ({ resolveElementOptions: vi.fn() }));
  vi.doMock("../helpers/utils", () => ({
    isDisabled: vi.fn(() => true), // default disabled
    removeMosAttributes: vi.fn(),
  }));
  return await import("../index.js");
};

beforeAll(() => {
  const { window } = new JSDOM("<html><body></body></html>");
  (global as any).window = window;
  (global as any).document = window.document;
  (global as any).HTMLElement = window.HTMLElement;
});

describe("bootstrap early-exit when disabled", () => {
  it("strips data attributes and skips observation", async () => {
    document.body.innerHTML = '<div data-mos="fade" data-mos-delay="50"></div>';

    const { MOS } = await freshIndex();
    const utils = await import("../helpers/utils.js");
    const observer = await import("../helpers/observer.js");

    MOS.init({ disable: true } as any);

    expect(utils.removeMosAttributes).toHaveBeenCalledTimes(1);
    expect(observer.observeElement).not.toHaveBeenCalled();
  });
});
