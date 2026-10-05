---
"motion-on-scroll": patch
---

- `cubic-bezier()` easings with negative control points (overshoot curves) are accepted.
- Empty `data-mos=""` and `data-mos-easing=""` attributes fall back to the defaults instead of being ignored or dropping the easing.
