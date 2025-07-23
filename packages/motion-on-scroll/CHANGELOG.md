# motion-on-scroll

## 0.0.5

### Patch Changes

- c4a7ac1: - Move to unified elements model to ensure all apects of code work with the most up-to-date MOS data
  - Remove various duplicate features, listeners, objects, etc.
  - Add additional tests
  - Simplify code
- ea4432f: Update init, refresh, and refreshHard functions to work closer to the original AOS for better feature parity
- 02c84b7: Refactor to use AOS type logic for viewport detection and handling instead of inView due to various issues noted in testing
