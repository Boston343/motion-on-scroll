import { JSDOM } from "jsdom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock refreshHard so we can assert against it
vi.mock("../index.js", () => ({
  refreshHard: vi.fn(),
}));

import { startDomObserver } from "../helpers/observer.js";
import { refreshHard } from "../index.js";

/**
 * Fake MutationObserver implementation for JSDOM that captures the callback
 * and options passed to `observe`. It allows manual triggering of mutations
 * within tests.
 */
class FakeMutationObserver {
  public callback: MutationCallback;
  public observedTarget: Node | null = null;
  public observedOptions: MutationObserverInit | null = null;

  constructor(cb: MutationCallback) {
    this.callback = cb;
    FakeMutationObserver.instances.push(this);
  }

  disconnect() {
    /* noop */
  }

  observe(target: Node, options?: MutationObserverInit) {
    this.observedTarget = target;
    this.observedOptions = options ?? null;
  }

  /** Utility to emit fake mutations */
  emit(mutations: MutationRecord[]) {
    this.callback(mutations, this as unknown as MutationObserver);
  }

  /** Registry so tests can access latest instance */
  static instances: FakeMutationObserver[] = [];
}

global.MutationObserver = FakeMutationObserver as unknown as typeof MutationObserver;

// Minimal DOM setup for dataset/element tests
beforeAll(() => {
  const { window } = new JSDOM("<html><body></body></html>");
  (global as any).window = window;
  (global as any).document = window.document;
  (global as any).HTMLElement = window.HTMLElement;
});

beforeEach(() => {
  // Clear mocks and previous instances before each test
  vi.clearAllMocks();
  FakeMutationObserver.instances.length = 0;
});

describe("observer utilities", () => {
  it("startDomObserver sets up MutationObserver on document.documentElement", () => {
    startDomObserver();

    expect(FakeMutationObserver.instances.length).toBe(1);
    const instance = FakeMutationObserver.instances[0]!;

    expect(instance.observedTarget).toBe(document.documentElement);
    expect(instance.observedOptions).toEqual({ childList: true, subtree: true });
  });

  it("triggers refreshHard when mutations affect data-mos elements", () => {
    startDomObserver();
    const instance = FakeMutationObserver.instances[0]!;

    // Create element with data-mos
    const el = document.createElement("div");
    el.dataset.mos = "fade";

    const mutation: MutationRecord = {
      addedNodes: [el] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      previousSibling: null,
      oldValue: null,
      target: document.body,
      type: "childList",
    } as MutationRecord;

    instance.emit([mutation]);
    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("does not trigger refreshHard when mutations do not affect data-mos elements", () => {
    startDomObserver();
    const instance = FakeMutationObserver.instances[0]!;

    const plain = document.createElement("span");

    const mutation: MutationRecord = {
      addedNodes: [plain] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      previousSibling: null,
      oldValue: null,
      target: document.body,
      type: "childList",
    } as MutationRecord;

    instance.emit([mutation]);
    expect(refreshHard).not.toHaveBeenCalled();
  });

  it("triggers refreshHard when data-mos attribute exists on descendant elements (recursive)", () => {
    startDomObserver();
    const instance = FakeMutationObserver.instances[0]!;

    const parent = document.createElement("div");
    const child = document.createElement("span");
    child.dataset.mos = "fade";
    parent.appendChild(child);

    const mutation: MutationRecord = {
      addedNodes: [parent] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      previousSibling: null,
      oldValue: null,
      target: document.body,
      type: "childList",
    } as MutationRecord;

    instance.emit([mutation]);
    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("ignores non-element nodes in mutation records", () => {
    startDomObserver();
    const instance = FakeMutationObserver.instances[0]!;

    const textNode = document.createTextNode("hello");

    const mutation: MutationRecord = {
      addedNodes: [textNode] as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      previousSibling: null,
      oldValue: null,
      target: document.body,
      type: "childList",
    } as MutationRecord;

    instance.emit([mutation]);
    expect(refreshHard).not.toHaveBeenCalled();
  });
});
