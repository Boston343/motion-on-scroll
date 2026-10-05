---
"motion-on-scroll": patch
---

Fix repeated `init()` calls: options are merged like AOS does, listeners are no longer duplicated, `timeUnits: "s"` no longer produces a 400 second duration, a changed `throttleDelay` takes effect, and `disable` is honoured on every call. Disabling after elements were scrolled out of view no longer leaves them invisible.
