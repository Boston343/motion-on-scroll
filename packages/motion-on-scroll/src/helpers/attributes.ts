import { DATA_PREFIX, DEFAULT_OPTIONS } from "./constants.js";
import type { ElementOptions, PartialMosOptions } from "./types.js";

/** Read a numeric attribute in pixels/ms etc. */
function readNumber(el: HTMLElement, name: string): number | undefined {
  const raw = el.dataset[name as keyof typeof el.dataset];
  if (raw == null) return undefined;
  const val = parseFloat(raw);
  return Number.isFinite(val) ? val : undefined;
}

export function resolveElementOptions(el: HTMLElement, global: PartialMosOptions): ElementOptions {
  const keyframes = el.dataset[DATA_PREFIX as any] || "fade";

  const opts: Partial<ElementOptions> = {
    offset: readNumber(el, `${DATA_PREFIX}Offset`),
    duration: readNumber(el, `${DATA_PREFIX}Duration`),
    delay: readNumber(el, `${DATA_PREFIX}Delay`),
    distance: readNumber(el, `${DATA_PREFIX}Distance`),
    easing: el.dataset[`${DATA_PREFIX}Easing` as any],
    anchor: el.dataset[`${DATA_PREFIX}Anchor` as any],
    once: el.hasAttribute(`data-${DATA_PREFIX}-once`)
      ? el.getAttribute(`data-${DATA_PREFIX}-once`) !== "false"
      : undefined,
    mirror: el.hasAttribute(`data-${DATA_PREFIX}-mirror`)
      ? el.getAttribute(`data-${DATA_PREFIX}-mirror`) !== "false"
      : undefined,
    anchorPlacement: el.dataset[`${DATA_PREFIX}AnchorPlacement` as any] as any,
  };

  const merged = { ...DEFAULT_OPTIONS, ...global, ...cleanUndefined(opts) } as ElementOptions;

  return { ...merged, keyframes };
}

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const k in obj) {
    if (obj[k] !== undefined) result[k] = obj[k];
  }
  return result;
}

export default {
  resolveElementOptions,
};
