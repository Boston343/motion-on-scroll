---
"motion-on-scroll": patch
---

- `data-mos-delay` / `delay` no longer corrupts the animation when an element animates out: the delay applies on the way in only, as in AOS. MOS now applies the delay for custom `registerAnimation` animations too, so their factory receives `opts.delay` as `0` and should not pass a delay to `animate()`.
- Trigger positions are recalculated once the page has fully loaded, so late-loading images no longer leave them stale (as in AOS).
- Elements waiting below the fold no longer keep a 60fps frame loop running.
