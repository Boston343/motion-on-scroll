---
"motion-on-scroll": minor
---

Closer AOS parity, a standalone CDN build, and a round of fixes.

**New**

- Standalone browser build at `dist/mos.global.js` for use from a CDN with a plain `<script>` tag. It bundles Motion and exposes a global `MOS` (including `MOS.animate`).
- `MOS.destroy()` removes all listeners and observers and stops tracking elements.
- `mos:in` / `mos:out` events on `document` (plus `mos:in:<id>` / `mos:out:<id>` with `data-mos-id`), matching AOS's `aos:in` / `aos:out`.
- AOS options `anchorPlacement` (now also global), `initClassName`, `animatedClassName` and `useClassNames`.
- `respectReducedMotion` option (default `true`): MOS is disabled for visitors who prefer reduced motion.
- The stylesheet now only applies on screen and to `html:not(.no-js)`, like AOS, and shows everything when printing.
- Types (`MosOptions`, `ElementOptions`, `AnimationFactory`, ...) are exported from the entry point, and `motion-on-scroll/mos.css` is available as an export.
- Works with Motion 12.23.3 and later, including 13 and 14.

**Behaviour changes to be aware of**

- Visitors who prefer reduced motion no longer get animations unless you pass `respectReducedMotion: false`.
- `ease`, `flip-left` and `flip-right` look different, because they now match AOS (see below).

**Fixed**

- Adding or removing a `data-mos` element (or calling `refresh()` / `refreshHard()` / `init()` again) no longer resets and replays every element that had already animated in, including `once` elements.
- `mos-animate` is now removed when an element animates out.
- Calling `init()` repeatedly merges options like AOS does, no longer registers duplicate listeners, and no longer produces a 400 second duration with `timeUnits: "s"`.
- `cubic-bezier()` easings with negative control points (overshoot curves) are accepted.
- `ease` now is the CSS `ease` curve, as in AOS.
- `flip-left` and `flip-right` rotate in the same direction as in AOS, and flips now have AOS's perspective.
- Changing `throttleDelay` on a later `init()` takes effect.
- `data-mos-delay` / `delay` no longer corrupts the animation when an element animates out: the delay now applies on the way in only, as in AOS.
- Elements waiting below the fold no longer keep a 60fps frame loop running.
- Trigger positions are recalculated once the page has fully loaded, so late-loading images no longer leave them stale (as in AOS).
- `disable` is honoured on every `init()` call, and disabling after elements were scrolled out of view no longer leaves them invisible.
- An element with an inline `data-mos-anchor-placement` and no inline offset triggers where AOS triggers it.
- Empty `data-mos=""` and `data-mos-easing=""` attributes fall back to the defaults instead of being ignored or dropping the easing.
