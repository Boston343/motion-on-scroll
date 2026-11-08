---
"motion-on-scroll": patch
---

Work around a Motion 14.2+ bug where a custom `registerAnimation` transform animation with an `onUpdate` callback did not show its first keyframe while waiting to play. The element sat at its final state below the fold or during `data-mos-delay`, then jumped back to the start when it played.
