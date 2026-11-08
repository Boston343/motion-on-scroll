---
"motion-on-scroll": patch
---

Stop idle frame loops again on Motion 14.7 and newer. Motion 14.7 changed its internals, so paused animations waiting below the fold (for example a custom `registerAnimation` that animates a colour) went back to running a `requestAnimationFrame` loop every frame until they played. Older Motion versions are unaffected.

The CDN build (`dist/mos.global.js`) now bundles Motion 14.10.1 instead of 14.0.0. Motion itself has grown, so the CDN file is about 6 KB (gzip) larger.
