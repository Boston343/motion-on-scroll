import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock refreshHard so we can assert against it
vi.mock("../index.js", () => ({
  refreshHard: vi.fn(),
}));

import { startDomObserver, stopDomObserver } from "../helpers/observer.js";
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
  public connected = false;
  public disconnectCalls = 0;

  constructor(cb: MutationCallback) {
    this.callback = cb;
    FakeMutationObserver.instances.push(this);
  }

  disconnect() {
    this.disconnectCalls++;
    this.connected = false;
  }

  observe(target: Node, options?: MutationObserverInit) {
    this.observedTarget = target;
    this.observedOptions = options ?? null;
    this.connected = true;
  }

  /** Utility to emit fake mutations */
  emit(mutations: MutationRecord[]) {
    this.callback(mutations, this as unknown as MutationObserver);
  }

  /** Registry so tests can access latest instance */
  static instances: FakeMutationObserver[] = [];
}

const RealMutationObserver = global.MutationObserver;

/** Builds a childList mutation record with the given added / removed nodes */
function mutationRecord(added: Node[] = [], removed: Node[] = []): MutationRecord {
  return {
    addedNodes: added as unknown as NodeList,
    removedNodes: removed as unknown as NodeList,
    attributeName: null,
    attributeNamespace: null,
    nextSibling: null,
    previousSibling: null,
    oldValue: null,
    target: document.body,
    type: "childList",
  } as MutationRecord;
}

/** Creates an element that carries a data-mos attribute */
function mosNode(value = "fade", tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute("data-mos", value);
  return el;
}

// Minimal DOM setup for dataset/element tests
beforeAll(() => {
  document.body.innerHTML = "";
});

beforeEach(() => {
  // Clear mocks and previous instances before each test
  vi.clearAllMocks();
  global.MutationObserver = FakeMutationObserver as unknown as typeof MutationObserver;
  FakeMutationObserver.instances.length = 0;
});

afterEach(() => {
  // observer.ts keeps the active observer in module state
  stopDomObserver();
  global.MutationObserver = RealMutationObserver;
  document.body.innerHTML = "";
});

// -----------------------------------------------------------------------------
// startDomObserver() / stopDomObserver()
// -----------------------------------------------------------------------------

describe("observer lifecycle", () => {
  it("startDomObserver sets up MutationObserver on document.documentElement", () => {
    startDomObserver();

    expect(FakeMutationObserver.instances.length).toBe(1);
    const instance = FakeMutationObserver.instances[0]!;

    expect(instance.observedTarget).toBe(document.documentElement);
    expect(instance.observedOptions).toEqual({ childList: true, subtree: true });
    expect(instance.connected).toBe(true);
  });

  it("startDomObserver disconnects the previous observer when called again", () => {
    startDomObserver();
    startDomObserver();

    expect(FakeMutationObserver.instances.length).toBe(2);
    const [first, second] = FakeMutationObserver.instances;

    expect(first!.connected).toBe(false);
    expect(second!.connected).toBe(true);
  });

  it("stopDomObserver disconnects the active observer", () => {
    startDomObserver();
    const instance = FakeMutationObserver.instances[0]!;

    stopDomObserver();

    expect(instance.disconnectCalls).toBe(1);
    expect(instance.connected).toBe(false);
  });

  it("stopDomObserver is safe to call before startDomObserver", () => {
    expect(() => stopDomObserver()).not.toThrow();
    expect(FakeMutationObserver.instances.length).toBe(0);
  });

  it("stopDomObserver is safe to call twice", () => {
    startDomObserver();
    const instance = FakeMutationObserver.instances[0]!;

    stopDomObserver();

    expect(() => stopDomObserver()).not.toThrow();
    expect(instance.disconnectCalls).toBe(1);
  });

  it("startDomObserver creates a fresh observer after stopDomObserver", () => {
    startDomObserver();
    stopDomObserver();
    startDomObserver();

    expect(FakeMutationObserver.instances.length).toBe(2);
    const [first, second] = FakeMutationObserver.instances;

    // the stopped observer must not be disconnected a second time or reused
    expect(first!.disconnectCalls).toBe(1);
    expect(second!.connected).toBe(true);
    expect(second!.observedTarget).toBe(document.documentElement);
  });
});

// -----------------------------------------------------------------------------
// Mutation handling
// -----------------------------------------------------------------------------

describe("observer mutation handling", () => {
  let instance: FakeMutationObserver;

  beforeEach(() => {
    startDomObserver();
    instance = FakeMutationObserver.instances[0]!;
  });

  it("triggers refreshHard when an added node has data-mos", () => {
    instance.emit([mutationRecord([mosNode("fade")])]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("does not trigger refreshHard when mutations do not affect data-mos elements", () => {
    const plain = document.createElement("span");
    plain.setAttribute("data-aos", "fade");
    plain.setAttribute("data-mosaic", "tile");

    instance.emit([mutationRecord([plain], [document.createElement("p")])]);

    expect(refreshHard).not.toHaveBeenCalled();
  });

  it("treats an empty data-mos attribute as a MOS node", () => {
    const el = mosNode("");
    expect(el.getAttribute("data-mos")).toBe("");

    instance.emit([mutationRecord([el])]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("treats a nested element with an empty data-mos attribute as a MOS node", () => {
    const parent = document.createElement("div");
    parent.appendChild(mosNode(""));

    instance.emit([mutationRecord([parent])]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("does not treat other data-mos-* attributes alone as a MOS node", () => {
    const el = document.createElement("div");
    el.setAttribute("data-mos-delay", "100");

    instance.emit([mutationRecord([el])]);

    expect(refreshHard).not.toHaveBeenCalled();
  });

  it("triggers refreshHard when data-mos exists on a direct child", () => {
    const parent = document.createElement("div");
    parent.appendChild(mosNode("fade", "span"));

    instance.emit([mutationRecord([parent])]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("triggers refreshHard when data-mos exists on a deeply nested descendant", () => {
    const root = document.createElement("section");
    root.innerHTML = `
      <div><p>plain</p></div>
      <div>
        <ul>
          <li>plain</li>
          <li><span><em data-mos="zoom-in">deep</em></span></li>
        </ul>
      </div>
    `;

    instance.emit([mutationRecord([root])]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("does not trigger refreshHard for a deep tree without data-mos elements", () => {
    const root = document.createElement("section");
    root.innerHTML = `<div><ul><li><span><em>deep</em></span></li></ul></div>`;

    instance.emit([mutationRecord([root])]);

    expect(refreshHard).not.toHaveBeenCalled();
  });

  it("ignores text and comment nodes", () => {
    const textNode = document.createTextNode("data-mos");
    const commentNode = document.createComment(' <div data-mos="fade"></div> ');

    instance.emit([mutationRecord([textNode, commentNode], [document.createTextNode("bye")])]);

    expect(refreshHard).not.toHaveBeenCalled();
  });

  it("still finds a MOS node listed after text and comment nodes", () => {
    const textNode = document.createTextNode("hello");
    const commentNode = document.createComment("note");

    instance.emit([mutationRecord([textNode, commentNode, mosNode("fade")])]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("triggers refreshHard when a data-mos element is removed", () => {
    instance.emit([mutationRecord([], [mosNode("fade")])]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("triggers refreshHard when a removed subtree contains a data-mos element", () => {
    const parent = document.createElement("div");
    const wrapper = document.createElement("div");
    wrapper.appendChild(mosNode("slide-up"));
    parent.appendChild(wrapper);

    instance.emit([mutationRecord([document.createElement("p")], [parent])]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("calls refreshHard only once for a batch with several MOS mutations", () => {
    instance.emit([
      mutationRecord([mosNode("fade"), mosNode("zoom-in")]),
      mutationRecord([mosNode("slide-up")], [mosNode("flip-left")]),
      mutationRecord([], [mosNode("fade")]),
    ]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("checks every mutation in a batch, not just the first one", () => {
    instance.emit([
      mutationRecord([document.createElement("p")]),
      mutationRecord([document.createTextNode("text")]),
      mutationRecord([mosNode("fade")]),
    ]);

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("calls refreshHard once per batch across separate batches", () => {
    instance.emit([mutationRecord([mosNode("fade")])]);
    instance.emit([mutationRecord([document.createElement("p")])]);
    instance.emit([mutationRecord([], [mosNode("fade")])]);

    expect(refreshHard).toHaveBeenCalledTimes(2);
  });

  it("does not trigger refreshHard for an empty batch", () => {
    instance.emit([]);
    instance.emit([mutationRecord()]);

    expect(refreshHard).not.toHaveBeenCalled();
  });

  it("calls refreshHard without arguments", () => {
    instance.emit([mutationRecord([mosNode("fade")])]);

    expect(refreshHard).toHaveBeenCalledWith();
  });
});

// -----------------------------------------------------------------------------
// Real MutationObserver (jsdom)
// -----------------------------------------------------------------------------

describe("observer with the real MutationObserver", () => {
  /** MutationObserver callbacks are delivered as microtasks */
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    global.MutationObserver = RealMutationObserver;
  });

  it("refreshes once when several data-mos elements are added in one go", async () => {
    startDomObserver();

    document.body.appendChild(mosNode("fade"));
    document.body.appendChild(mosNode(""));
    const wrapper = document.createElement("div");
    wrapper.appendChild(mosNode("zoom-in"));
    document.body.appendChild(wrapper);
    await flush();

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("refreshes when a data-mos element is removed from the DOM", async () => {
    const wrapper = document.createElement("div");
    wrapper.appendChild(mosNode("fade"));
    document.body.appendChild(wrapper);
    startDomObserver();

    wrapper.remove();
    await flush();

    expect(refreshHard).toHaveBeenCalledTimes(1);
  });

  it("does not refresh for unrelated DOM changes", async () => {
    startDomObserver();

    const plain = document.createElement("p");
    plain.textContent = "hello";
    document.body.appendChild(plain);
    plain.remove();
    await flush();

    expect(refreshHard).not.toHaveBeenCalled();
  });

  it("no longer refreshes after stopDomObserver", async () => {
    startDomObserver();
    stopDomObserver();

    document.body.appendChild(mosNode("fade"));
    await flush();

    expect(refreshHard).not.toHaveBeenCalled();
  });

  it("drops mutations that were queued before stopDomObserver", async () => {
    startDomObserver();

    document.body.appendChild(mosNode("fade"));
    stopDomObserver();
    await flush();

    expect(refreshHard).not.toHaveBeenCalled();
  });
});
