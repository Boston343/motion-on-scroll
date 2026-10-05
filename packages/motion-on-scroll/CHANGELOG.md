# motion-on-scroll

## 1.1.0

### Minor Changes

- 69e7051: Add the remaining AOS options and events:

  - `mos:in` / `mos:out` events on `document` (plus `mos:in:<id>` / `mos:out:<id>` with `data-mos-id`), matching AOS's `aos:in` / `aos:out`.
  - `initClassName`, `animatedClassName` and `useClassNames`.
  - `anchorPlacement` can now be set globally as well as per element.

- 69e7051: Add a standalone browser build at `dist/mos.global.js` for use from a CDN with a plain `<script>` tag. It bundles Motion and exposes a global `MOS` (including `MOS.animate`), the same way AOS exposes `AOS`.
- 69e7051: Add `MOS.destroy()`, which removes all listeners and observers and stops tracking elements.

  Types (`MosOptions`, `PartialMosOptions`, `ElementOptions`, `AnchorPlacement`, `DeviceDisable`, `AnimationFactory`, `EasingDefinition`) are now exported from the entry point, and the stylesheet is also available as `motion-on-scroll/mos.css`.

  Works with Motion 12.23.3 and later, including 13 and 14.

- 69e7051: Add a `respectReducedMotion` option (default `true`). **Behaviour change:** visitors who prefer reduced motion no longer get animations unless you pass `respectReducedMotion: false`.

  The stylesheet now only applies on screen and to `html:not(.no-js)`, like AOS, and shows every element when printing. Selector specificity is unchanged.

### Patch Changes

- 69e7051: Match AOS visually. **These look different from 1.0.0:**

  - `ease` is now the CSS `ease` curve.
  - `flip-left` and `flip-right` rotate in the same direction as in AOS, and all flips have AOS's perspective.
  - An element with an inline `data-mos-anchor-placement` and no inline offset triggers where AOS triggers it.

- 69e7051: - `cubic-bezier()` easings with negative control points (overshoot curves) are accepted.
  - Empty `data-mos=""` and `data-mos-easing=""` attributes fall back to the defaults instead of being ignored or dropping the easing.
- 69e7051: - `data-mos-delay` / `delay` no longer corrupts the animation when an element animates out: the delay applies on the way in only, as in AOS. MOS now applies the delay for custom `registerAnimation` animations too, so their factory receives `opts.delay` as `0` and should not pass a delay to `animate()`.
  - Trigger positions are recalculated once the page has fully loaded, so late-loading images no longer leave them stale (as in AOS).
  - Elements waiting below the fold no longer keep a 60fps frame loop running.
- 69e7051: Fix repeated `init()` calls: options are merged like AOS does, listeners are no longer duplicated, `timeUnits: "s"` no longer produces a 400 second duration, a changed `throttleDelay` takes effect, and `disable` is honoured on every call. Disabling after elements were scrolled out of view no longer leaves them invisible.
- 69e7051: Adding or removing a `data-mos` element, or calling `refresh()`, `refreshHard()` or `init()` again, no longer resets and replays every element that had already animated in (including `once` elements). `mos-animate` is now removed when an element animates out.

## 1.0.0

### Major Changes

- c07435b: v1.0.0 release - now out of beta! Full documentation on the features and functionality can be found at [motion-on-scroll.pages.dev](https://motion-on-scroll.pages.dev/).

## 0.0.6

### Patch Changes

- 083a02c: Fix potential element flash on page resize. Also add additional tests for verification.
- ae9e4c5: Fix setting units in init function when not explicitly setting duration and delay. Also add additional tests for verification.

## 0.0.5

### Patch Changes

- c4a7ac1: - Move to unified elements model to ensure all apects of code work with the most up-to-date MOS data
  - Remove various duplicate features, listeners, objects, etc.
  - Add additional tests
  - Simplify code
- ea4432f: Update init, refresh, and refreshHard functions to work closer to the original AOS for better feature parity
- 02c84b7: Refactor to use AOS type logic for viewport detection and handling instead of inView due to various issues noted in testing
