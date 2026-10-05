---
"motion-on-scroll": patch
---

- `data-mos-delay` / `delay` no longer corrupts the animation when an element animates out: the delay applies on the way in only, as in AOS.
- Trigger positions are recalculated once the page has fully loaded, so late-loading images no longer leave them stale (as in AOS).
- Elements waiting below the fold no longer keep a 60fps frame loop running.
