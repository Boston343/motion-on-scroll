---
"motion-on-scroll": patch
---

Adding or removing a `data-mos` element, or calling `refresh()`, `refreshHard()` or `init()` again, no longer resets and replays every element that had already animated in (including `once` elements). `mos-animate` is now removed when an element animates out.
