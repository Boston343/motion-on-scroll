# motion-on-scroll

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
