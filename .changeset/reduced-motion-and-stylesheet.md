---
"motion-on-scroll": minor
---

Add a `respectReducedMotion` option (default `true`). **Behaviour change:** visitors who prefer reduced motion no longer get animations unless you pass `respectReducedMotion: false`.

The stylesheet now only applies on screen and to `html:not(.no-js)`, like AOS, and shows every element when printing. Selector specificity is unchanged.
