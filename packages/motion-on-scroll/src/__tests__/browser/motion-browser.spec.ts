// ===================================================================
// REAL-BROWSER CHECKS (real Motion, real layout)
// ===================================================================
// The jsdom specs mock Motion and have no layout or WAAPI, so they cannot show
// what an element looks like or whether Motion's frame loop is running. These
// specs run MOS from source with the installed `motion` in headless Chromium and
// sample computed styles, like a visitor scrolling a page would see them.

import "../../css/mos.css";

import { animate } from "motion";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { MOS } from "../../index.js";

// ===================================================================
// HELPERS
// ===================================================================

const DURATION_MS = 200;

/** First and last keyframes of the custom animations, as computed styles */
const SHIFTED = "matrix(1, 0, 0, 1, 100, 0)";
const RED = "rgb(255, 0, 0)";
const BLUE = "rgb(0, 0, 255)";

/** Resolves after `ms` milliseconds */
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Counts the animation frames requested while waiting
 *
 * @param ms - How long to watch for
 * @returns Number of requestAnimationFrame calls in that time
 */
async function frameRequestsDuring(ms: number): Promise<number> {
  const before = globalThis.mosFrameRequests();
  await wait(ms);
  return globalThis.mosFrameRequests() - before;
}

/**
 * Scrolls so the element sits in the middle of the viewport, or back to the top
 *
 * @param element - Element to bring into view; omit to scroll to the top
 */
async function scrollTo(element?: HTMLElement): Promise<void> {
  const top = element ? element.offsetTop - window.innerHeight / 2 : 0;
  window.scrollTo(0, top);
  // Scroll handling is throttled (99ms), then the animation runs
  await wait(150 + DURATION_MS + 150);
}

/**
 * Builds a page with each element far below the fold and starts MOS
 *
 * @param animations - `data-mos` value per element
 * @returns The elements, in the same order
 */
function setUpPage(animations: string[], attributes: Record<string, string> = {}): HTMLElement[] {
  document.body.innerHTML = "";
  const spacer = (): HTMLElement => {
    const div = document.createElement("div");
    div.style.height = "2000px";
    return div;
  };

  document.body.appendChild(spacer());
  const elements = animations.map((name) => {
    const element = document.createElement("div");
    element.setAttribute("data-mos", name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    element.style.height = "100px";
    element.style.backgroundColor = "gray";
    document.body.appendChild(element);
    document.body.appendChild(spacer());
    return element;
  });

  MOS.init({ duration: DURATION_MS });
  return elements;
}

const style = (element: HTMLElement): CSSStyleDeclaration => getComputedStyle(element);

// ===================================================================
// SETUP
// ===================================================================

beforeAll(() => {
  // A colour animation never goes to the compositor, so Motion runs it in its
  // own frame loop: the case where a paused animation can keep that loop busy
  MOS.registerAnimation("browser-colour", (element) =>
    animate(element, { backgroundColor: [RED, BLUE] }, { duration: DURATION_MS / 1000 }),
  );

  // An onUpdate callback keeps a transform animation off the compositor
  // (motiondivision/motion#4073 hits exactly this shape on Motion 14.2+)
  MOS.registerAnimation("browser-shift", (element) =>
    animate(element, { x: [100, 0] }, { duration: DURATION_MS / 1000, onUpdate: () => {} }),
  );
});

afterEach(async () => {
  MOS.destroy();
  window.scrollTo(0, 0);
  document.body.innerHTML = "";
  await wait(50);
});

// ===================================================================
// TESTS
// ===================================================================

describe("waiting elements", () => {
  it("frame counter sees a busy Motion frame loop", async () => {
    // A paused animation MOS has not parked: the case the next test guards against
    const element = document.createElement("div");
    document.body.appendChild(element);
    const controls = animate(element, { backgroundColor: [RED, BLUE] }, { duration: 1 });
    controls.pause();
    await wait(100);

    expect(await frameRequestsDuring(500)).toBeGreaterThan(10);
    controls.stop();
  });

  it("leave Motion's frame loop idle", async () => {
    setUpPage(["fade-up", "flip-left", "browser-colour", "browser-shift"]);
    await wait(300);

    // A paused animation that is not parked requests a frame every frame (~30 here)
    expect(await frameRequestsDuring(500)).toBeLessThanOrEqual(2);
  });

  it("sit on their first keyframe", async () => {
    const [fade, colour, shift] = setUpPage(["fade-up", "browser-colour", "browser-shift"]);
    await wait(300);

    expect(style(fade!).opacity).toBe("0");
    expect(style(fade!).transform).toBe("matrix(1, 0, 0, 1, 0, 100)");
    expect(style(colour!).backgroundColor).toBe(RED);
    // Without the first-frame workaround, Motion 14.2+ leaves this at its end (none)
    expect(style(shift!).transform).toBe(SHIFTED);
  });

  it("wait on their first keyframe during the show delay", async () => {
    // In view at load, so the delay is the only thing holding it back
    document.body.innerHTML = "";
    const element = document.createElement("div");
    element.setAttribute("data-mos", "browser-shift");
    element.setAttribute("data-mos-delay", "400");
    element.style.height = "100px";
    document.body.appendChild(element);
    MOS.init({ duration: DURATION_MS });

    await wait(200);
    expect(style(element).transform).toBe(SHIFTED);

    await wait(200 + DURATION_MS + 200);
    expect(style(element).transform).toBe("none");
  });
});

describe("parked elements", () => {
  it.each([
    ["a compositor preset", "fade-up"],
    ["a colour animation", "browser-colour"],
    ["a transform with onUpdate", "browser-shift"],
  ])("play %s in, out and in again", async (_label, name) => {
    const [element] = setUpPage([name]);
    await wait(300);
    const shown = (): string =>
      name === "browser-colour"
        ? style(element!).backgroundColor
        : `${style(element!).opacity} ${style(element!).transform}`;

    const hidden = shown();
    await scrollTo(element);
    const visible = shown();
    expect(visible).not.toBe(hidden);
    expect(visible).toBe(name === "browser-colour" ? BLUE : "1 none");

    await scrollTo();
    expect(shown()).toBe(hidden);

    await scrollTo(element);
    expect(shown()).toBe(visible);

    // Finished animations leave the frame loop idle again. MOS.destroy() leaves
    // animations as they are, so a paused animation left unparked by an earlier
    // test (or an earlier page in an SPA) would show up here too.
    expect(await frameRequestsDuring(300)).toBeLessThanOrEqual(2);
  });
});
